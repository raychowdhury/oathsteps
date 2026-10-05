"use client";
import type { MockState } from "@/domain/mock";
import { applyAttempt, newReviewState } from "@/domain/scheduler";
import { todayDateOnly } from "@/domain/dates";
import type { ChecklistEntry, ConfirmedDynamicAnswer, EnglishTaskRecord, PracticeAttempt, StudyProfile } from "@/domain/types";
import type { Journey } from "@/domain/journey";
import { getDb } from "./store/db";
import { notifyStoreChanged } from "./store/events";
import { getMeta, markOutbox, pendingOutbox, setMeta } from "./store/repo";

export interface SyncStatus {
  lastPushAt?: string;
  lastPullAt?: string;
  lastError?: string;
}

/** Push pending outbox events in batches. Safe to call repeatedly; the server dedupes by eventId. */
export async function pushOutbox(): Promise<{ sent: number; failed: number; error?: string }> {
  const events = await pendingOutbox(500);
  if (!events.length) return { sent: 0, failed: 0 };
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ events: events.map((e) => ({ eventId: e.eventId, type: e.type, payload: e.payload, createdAt: e.createdAt })) }),
    });
    if (res.status === 401) throw new Error("Not signed in");
    if (!res.ok) throw new Error(`Sync failed (${res.status})`);
    const r = (await res.json()) as { stored: string[]; duplicate: string[]; rejected: { eventId: string; reason: string }[] };
    await markOutbox([...r.stored, ...r.duplicate], "sent");
    if (r.rejected.length) await markOutbox(r.rejected.map((x) => x.eventId), "failed", r.rejected[0].reason);
    await setMeta("sync", { ...((await getMeta<SyncStatus>("sync")) ?? {}), lastPushAt: new Date().toISOString(), lastError: r.rejected[0]?.reason });
    return { sent: r.stored.length + r.duplicate.length, failed: r.rejected.length };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await markOutbox(events.map((x) => x.eventId), "failed", error);
    await setMeta("sync", { ...((await getMeta<SyncStatus>("sync")) ?? {}), lastError: error });
    return { sent: 0, failed: events.length, error };
  }
}

/**
 * Pull the account's events and merge them into the local store. Existing local records win on
 * identical ids (they are the same event); review states are rebuilt from attempts in time order.
 */
export async function pullAndMerge(): Promise<{ merged: number; error?: string }> {
  try {
    const res = await fetch("/api/sync", { credentials: "same-origin" });
    if (!res.ok) throw new Error(res.status === 401 ? "Not signed in" : `Pull failed (${res.status})`);
    const snap = (await res.json()) as { events: { eventId: string; type: string; payload: unknown; createdAt: string }[]; profile: StudyProfile | null };
    const db = await getDb();
    const tx = db.transaction(["attempts", "reviewStates", "mocks", "journey", "checklist", "englishTasks", "bookmarks", "dynamicAnswers", "reports", "outbox", "profile"], "readwrite");
    let merged = 0;
    const attempts: PracticeAttempt[] = [];
    for (const ev of snap.events) {
      const p = ev.payload as Record<string, unknown>;
      switch (ev.type) {
        case "attempt": {
          const a = p as unknown as PracticeAttempt;
          if (!(await tx.objectStore("attempts").get(a.id))) {
            await tx.objectStore("attempts").put(a);
            merged++;
          }
          attempts.push(a);
          break;
        }
        case "mock": {
          const m = p as unknown as MockState;
          if (!(await tx.objectStore("mocks").get(m.config.id))) {
            await tx.objectStore("mocks").put(m);
            merged++;
          }
          break;
        }
        case "journey": {
          // Events are applied oldest first, so the last journey snapshot wins.
          await tx.objectStore("journey").put({ ...(p as unknown as Journey), id: "local" });
          merged++;
          break;
        }
        case "checklist": {
          await tx.objectStore("checklist").put(p as unknown as ChecklistEntry);
          merged++;
          break;
        }
        case "english": {
          const r = p as unknown as EnglishTaskRecord;
          if (!(await tx.objectStore("englishTasks").get(r.id))) {
            await tx.objectStore("englishTasks").put(r);
            merged++;
          }
          break;
        }
        case "bookmark": {
          if (p.bookmarked) await tx.objectStore("bookmarks").put({ questionId: String(p.questionId), at: ev.createdAt });
          else await tx.objectStore("bookmarks").delete(String(p.questionId));
          merged++;
          break;
        }
        case "dynamic-answer": {
          if (p.cleared) await tx.objectStore("dynamicAnswers").delete(String(p.questionId));
          else await tx.objectStore("dynamicAnswers").put(p as unknown as ConfirmedDynamicAnswer);
          merged++;
          break;
        }
        case "report": {
          await tx.objectStore("reports").put(p as never);
          merged++;
          break;
        }
        default:
          break;
      }
      // Mark the event as already synced so it is not re-sent.
      if (!(await tx.objectStore("outbox").get(ev.eventId))) await tx.objectStore("outbox").put({ eventId: ev.eventId, type: ev.type as never, payload: ev.payload, createdAt: ev.createdAt, status: "sent", tries: 0 });
    }
    // Rebuild review states from the union of attempts, oldest first.
    const all = (await tx.objectStore("attempts").getAll()).sort((a, b) => a.at.localeCompare(b.at));
    const today = todayDateOnly();
    const states = new Map<string, ReturnType<typeof newReviewState>>();
    for (const a of all) {
      const s = states.get(a.questionId) ?? newReviewState(a.questionId, a.bank, today);
      states.set(a.questionId, applyAttempt(s, a));
    }
    for (const s of states.values()) await tx.objectStore("reviewStates").put(s);
    if (snap.profile) {
      const local = await tx.objectStore("profile").get("local");
      if (!local || !local.onboarded || local.updatedAt < snap.profile.updatedAt) await tx.objectStore("profile").put({ ...snap.profile, id: "local" });
    }
    await tx.done;
    await setMeta("sync", { ...((await getMeta<SyncStatus>("sync")) ?? {}), lastPullAt: new Date().toISOString() });
    notifyStoreChanged();
    return { merged };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await setMeta("sync", { ...((await getMeta<SyncStatus>("sync")) ?? {}), lastError: error });
    return { merged: 0, error };
  }
}

export async function recordConsent(purpose: "migrate-guest-progress" | "sync"): Promise<boolean> {
  const res = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ purpose, version: "2026-10-05" }) });
  if (res.ok) await setMeta(`consent:${purpose}`, { grantedAt: new Date().toISOString() });
  return res.ok;
}
