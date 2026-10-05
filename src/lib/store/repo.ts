import type { MockState } from "@/domain/mock";
import { applyAttempt, newReviewState } from "@/domain/scheduler";
import { todayDateOnly } from "@/domain/dates";
import type { ChecklistEntry, ConfirmedDynamicAnswer, EnglishTaskRecord, Milestone, PracticeAttempt, ReviewState, StudyProfile } from "@/domain/types";
import { getDb, type CorrectionReport, type OutboxEvent } from "./db";
import { newId, notifyStoreChanged, nowIso } from "./events";

export function defaultProfile(): StudyProfile {
  const t = nowIso();
  return {
    id: "local",
    filingDate: null,
    filingDateUnknown: false,
    provisionalBank: null,
    specialConsideration: false,
    state: null,
    interviewDate: null,
    studyDeadline: null,
    textSize: "normal",
    audioRate: 0.9,
    audioAutoplay: false,
    reduceMotion: false,
    newPerDay: 5,
    reminders: { study: true, appointments: true, checklist: true },
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
  return (await db.get("profile", "local")) ?? defaultProfile();
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

// Milestones --------------------------------------------------------------------------------------
export async function listMilestones(): Promise<Milestone[]> {
  const all = await (await getDb()).getAll("milestones");
  return all.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.createdAt.localeCompare(b.createdAt));
}

export async function upsertMilestone(m: Omit<Milestone, "createdAt" | "updatedAt" | "provenance"> & Partial<Milestone>): Promise<Milestone> {
  const db = await getDb();
  const prev = await db.get("milestones", m.id);
  const next: Milestone = { ...m, provenance: "user", createdAt: prev?.createdAt ?? nowIso(), updatedAt: nowIso() };
  await db.put("milestones", next);
  await enqueue("milestone", next);
  notifyStoreChanged();
  return next;
}

export async function deleteMilestone(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("milestones", id);
  await enqueue("milestone", { id, deleted: true });
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

export async function clearDynamicAnswer(questionId: string): Promise<void> {
  const db = await getDb();
  await db.delete("dynamicAnswers", questionId);
  await enqueue("dynamic-answer", { questionId, cleared: true });
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
    format: 1,
    profile: await getProfile(),
    attempts: await db.getAll("attempts"),
    reviewStates: await db.getAll("reviewStates"),
    mocks: await db.getAll("mocks"),
    milestones: await db.getAll("milestones"),
    checklist: await db.getAll("checklist"),
    englishTasks: await db.getAll("englishTasks"),
    bookmarks: await db.getAll("bookmarks"),
    dynamicAnswers: await db.getAll("dynamicAnswers"),
    reports: await db.getAll("reports"),
  };
}

/** Clear learning data but keep preferences (reset). */
export async function resetLearningData(): Promise<void> {
  const db = await getDb();
  const stores = ["attempts", "reviewStates", "mocks", "milestones", "checklist", "englishTasks", "bookmarks", "dynamicAnswers", "reports", "outbox"] as const;
  const tx = db.transaction([...stores], "readwrite");
  await Promise.all(stores.map((s) => tx.objectStore(s).clear()));
  await tx.done;
  notifyStoreChanged();
}
