import { emptyJourney, type Journey, type JourneyKey, type Slot } from "@/domain/journey";
import type { MockState } from "@/domain/mock";
import { applyAttempt, newReviewState } from "@/domain/scheduler";
import { todayDateOnly } from "@/domain/dates";
import type { ChecklistEntry, ConfirmedDynamicAnswer, EnglishTaskRecord, PracticeAttempt, ReviewState, StudyProfile } from "@/domain/types";
import { getDb, type CorrectionReport, type OutboxEvent } from "./db";
import { newId, notifyStoreChanged, nowIso } from "./events";

export function defaultProfile(): StudyProfile {
  const t = nowIso();
  return {
    id: "local",
    filingDate: null,
    filingDateUnknown: false,
    specialConsideration: false,
    state: null,
    textSize: "normal",
    theme: "system",
    audioRate: 1,
    reduceMotion: false,
    mode: "recall",
    autoplay: false,
    reminders: { study: true, daily: true, review: true, appointments: true, quietFrom: 21, quietTo: 8 },
    createdAt: t,
    updatedAt: t,
    onboarded: false,
  };
}

async function enqueue(type: OutboxEvent["type"], payload: unknown, eventId = newId()) {
  const db = await getDb();
  const existing = await db.get("outbox", eventId);
  if (existing) return;
  await db.put("outbox", { eventId, type, payload, createdAt: nowIso(), status: "pending", tries: 0 });
}

// Profile -----------------------------------------------------------------------------------------
export async function getProfile(): Promise<StudyProfile> {
  const db = await getDb();
  return { ...defaultProfile(), ...((await db.get("profile", "local")) ?? {}) };
}

export async function saveProfile(patch: Partial<StudyProfile>): Promise<StudyProfile> {
  const db = await getDb();
  const next = { ...(await getProfile()), ...patch, id: "local" as const, updatedAt: nowIso() };
  await db.put("profile", next);
  await enqueue("profile", next);
  notifyStoreChanged();
  return next;
}

// Attempts + review -------------------------------------------------------------------------------
export async function recordAttempt(attempt: PracticeAttempt, timeZone?: string): Promise<{ stored: boolean; review: ReviewState }> {
  const db = await getDb();
  const tx = db.transaction(["attempts", "reviewStates", "outbox"], "readwrite");
  const existing = await tx.objectStore("attempts").get(attempt.id);
  let review = (await tx.objectStore("reviewStates").get(attempt.questionId)) ?? newReviewState(attempt.questionId, attempt.bank, todayDateOnly(undefined, timeZone));
  if (existing) {
    await tx.done;
    return { stored: false, review };
  }
  await tx.objectStore("attempts").put(attempt);
  review = applyAttempt(review, attempt, timeZone);
  await tx.objectStore("reviewStates").put(review);
  await tx.objectStore("outbox").put({ eventId: attempt.id, type: "attempt", payload: attempt, createdAt: nowIso(), status: "pending", tries: 0 });
  await tx.done;
  notifyStoreChanged();
  return { stored: true, review };
}

export async function listAttempts(): Promise<PracticeAttempt[]> {
  return (await getDb()).getAllFromIndex("attempts", "byAt");
}

export async function listReviewStates(): Promise<ReviewState[]> {
  return (await getDb()).getAll("reviewStates");
}

// Mocks -------------------------------------------------------------------------------------------
export async function saveMock(state: MockState): Promise<void> {
  const db = await getDb();
  await db.put("mocks", state);
  if (state.status === "finished") await enqueue("mock", state, `mock:${state.config.id}`);
  notifyStoreChanged();
}

export async function listMocks(): Promise<MockState[]> {
  return (await getDb()).getAll("mocks");
}

export async function getOpenMock(): Promise<MockState | null> {
  const all = await listMocks();
  return all.find((m) => m.status === "active" || m.status === "paused") ?? null;
}

// Journey (seven slots) ---------------------------------------------------------------------------
export async function getJourney(): Promise<Journey> {
  const db = await getDb();
  const stored = await db.get("journey", "local");
  if (!stored) return emptyJourney();
  const { id, ...rest } = stored;
  void id;
  return { ...emptyJourney(), ...rest };
}

export async function setJourneySlot(key: JourneyKey, slot: Slot): Promise<Journey> {
  const db = await getDb();
  const next = { ...(await getJourney()), [key]: slot };
  await db.put("journey", { ...next, id: "local" });
  await enqueue("journey", next);
  notifyStoreChanged();
  return next;
}

export async function saveJourney(j: Journey): Promise<void> {
  const db = await getDb();
  await db.put("journey", { ...j, id: "local" });
  await enqueue("journey", j);
  notifyStoreChanged();
}

// Checklist ---------------------------------------------------------------------------------------
export async function listChecklist(): Promise<ChecklistEntry[]> {
  return (await getDb()).getAll("checklist");
}

export async function setChecklist(entry: ChecklistEntry): Promise<void> {
  const db = await getDb();
  await db.put("checklist", entry);
  await enqueue("checklist", entry);
  notifyStoreChanged();
}

// English -----------------------------------------------------------------------------------------
export async function recordEnglishTask(rec: EnglishTaskRecord): Promise<void> {
  const db = await getDb();
  if (await db.get("englishTasks", rec.id)) return;
  await db.put("englishTasks", rec);
  await enqueue("english", rec, rec.id);
  notifyStoreChanged();
}

export async function listEnglishTasks(): Promise<EnglishTaskRecord[]> {
  return (await getDb()).getAllFromIndex("englishTasks", "byAt");
}

// Bookmarks ---------------------------------------------------------------------------------------
export async function listBookmarks(): Promise<string[]> {
  return (await (await getDb()).getAll("bookmarks")).map((b) => b.questionId);
}

export async function toggleBookmark(questionId: string): Promise<boolean> {
  const db = await getDb();
  const has = await db.get("bookmarks", questionId);
  if (has) await db.delete("bookmarks", questionId);
  else await db.put("bookmarks", { questionId, at: nowIso() });
  await enqueue("bookmark", { questionId, bookmarked: !has });
  notifyStoreChanged();
  return !has;
}

// Dynamic answers ---------------------------------------------------------------------------------
export async function listDynamicAnswers(): Promise<ConfirmedDynamicAnswer[]> {
  return (await getDb()).getAll("dynamicAnswers");
}

export async function saveDynamicAnswer(a: ConfirmedDynamicAnswer): Promise<void> {
  const db = await getDb();
  await db.put("dynamicAnswers", a);
  await enqueue("dynamic-answer", a);
  notifyStoreChanged();
}

// Reports -----------------------------------------------------------------------------------------
export async function saveReport(r: CorrectionReport): Promise<void> {
  const db = await getDb();
  await db.put("reports", r);
  await enqueue("report", r, r.id);
  notifyStoreChanged();
}

export async function listReports(): Promise<CorrectionReport[]> {
  return (await getDb()).getAll("reports");
}

// Meta --------------------------------------------------------------------------------------------
export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await getDb()).get("meta", key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await getDb()).put("meta", { key, value });
  notifyStoreChanged();
}

/** Per-day "done" flags for the Today plan. */
export interface DayProgress {
  date: string;
  review: boolean;
  fresh: boolean;
  english: boolean;
}
export async function getDayProgress(today: string): Promise<DayProgress> {
  const d = await getMeta<DayProgress>("dayProgress");
  return d && d.date === today ? d : { date: today, review: false, fresh: false, english: false };
}
export async function markDay(today: string, patch: Partial<Omit<DayProgress, "date">>): Promise<void> {
  await setMeta("dayProgress", { ...(await getDayProgress(today)), ...patch, date: today });
}
export async function getSessions(): Promise<number> {
  return (await getMeta<number>("sessions")) ?? 0;
}
export async function bumpSessions(): Promise<void> {
  await setMeta("sessions", (await getSessions()) + 1);
}

// Outbox ------------------------------------------------------------------------------------------
export async function pendingOutbox(limit = 200): Promise<OutboxEvent[]> {
  const db = await getDb();
  const pending = await db.getAllFromIndex("outbox", "byStatus", "pending");
  const failed = await db.getAllFromIndex("outbox", "byStatus", "failed");
  return [...pending, ...failed].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, limit);
}

export async function markOutbox(eventIds: string[], status: OutboxEvent["status"], error?: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("outbox", "readwrite");
  for (const id of eventIds) {
    const ev = await tx.store.get(id);
    if (ev) await tx.store.put({ ...ev, status, tries: ev.tries + 1, lastError: error });
  }
  await tx.done;
  notifyStoreChanged();
}

export async function outboxSummary(): Promise<{ pending: number; failed: number; lastError?: string }> {
  const db = await getDb();
  const pending = await db.countFromIndex("outbox", "byStatus", "pending");
  const failed = await db.getAllFromIndex("outbox", "byStatus", "failed");
  return { pending, failed: failed.length, lastError: failed.at(-1)?.lastError };
}

// Export / reset ----------------------------------------------------------------------------------
export async function exportAll() {
  const db = await getDb();
  return {
    exportedAt: nowIso(),
    app: "OathSteps",
    format: 2,
    demoData: Boolean(await getMeta<boolean>("illustrative")),
    profile: await getProfile(),
    attempts: await db.getAll("attempts"),
    reviewStates: await db.getAll("reviewStates"),
    mocks: await db.getAll("mocks"),
    journey: await getJourney(),
    checklist: await db.getAll("checklist"),
    englishTasks: await db.getAll("englishTasks"),
    bookmarks: await db.getAll("bookmarks"),
    dynamicAnswers: await db.getAll("dynamicAnswers"),
    reports: await db.getAll("reports"),
  };
}

/** Reset practice progress: attempts, reviews, mocks, bookmarks, English checks. Journey and settings stay. */
export async function resetPractice(): Promise<void> {
  const db = await getDb();
  const stores = ["attempts", "reviewStates", "mocks", "bookmarks", "englishTasks"] as const;
  const tx = db.transaction([...stores, "meta"], "readwrite");
  await Promise.all(stores.map((s) => tx.objectStore(s).clear()));
  for (const k of ["dayProgress", "sessions", "illustrative"]) await tx.objectStore("meta").delete(k);
  await tx.done;
  notifyStoreChanged();
}
