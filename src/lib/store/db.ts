import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { MockState } from "@/domain/mock";
import type { ChecklistEntry, ConfirmedDynamicAnswer, EnglishTaskRecord, Milestone, PracticeAttempt, ReviewState, StudyProfile } from "@/domain/types";

/** Append-only event destined for the server when the learner has an account. */
export interface OutboxEvent {
  eventId: string;
  type: "attempt" | "review" | "mock" | "milestone" | "checklist" | "english" | "profile" | "dynamic-answer" | "bookmark" | "report";
  payload: unknown;
  createdAt: string;
  status: "pending" | "sent" | "failed";
  tries: number;
  lastError?: string;
}

export interface CorrectionReport {
  id: string;
  questionId: string;
  packVersion: string;
  message: string;
  createdAt: string;
}

export interface MetaRecord {
  key: string;
  value: unknown;
}

export interface OathStepsDB extends DBSchema {
  profile: { key: string; value: StudyProfile };
  attempts: { key: string; value: PracticeAttempt; indexes: { byQuestion: string; byAt: string } };
  reviewStates: { key: string; value: ReviewState; indexes: { byDue: string } };
  mocks: { key: string; value: MockState; indexes: { byStatus: string } };
  milestones: { key: string; value: Milestone };
  checklist: { key: string; value: ChecklistEntry };
  englishTasks: { key: string; value: EnglishTaskRecord; indexes: { byAt: string } };
  bookmarks: { key: string; value: { questionId: string; at: string } };
  dynamicAnswers: { key: string; value: ConfirmedDynamicAnswer };
  outbox: { key: string; value: OutboxEvent; indexes: { byStatus: string } };
  reports: { key: string; value: CorrectionReport };
  meta: { key: string; value: MetaRecord };
}

export const DB_NAME = "oathsteps";
export const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<OathStepsDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<OathStepsDB>> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is not available in this environment"));
  if (!dbPromise) {
    dbPromise = openDB<OathStepsDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("profile", { keyPath: "id" });
        const attempts = db.createObjectStore("attempts", { keyPath: "id" });
        attempts.createIndex("byQuestion", "questionId");
        attempts.createIndex("byAt", "at");
        const review = db.createObjectStore("reviewStates", { keyPath: "questionId" });
        review.createIndex("byDue", "dueOn");
        const mocks = db.createObjectStore("mocks", { keyPath: "config.id" });
        mocks.createIndex("byStatus", "status");
        db.createObjectStore("milestones", { keyPath: "id" });
        db.createObjectStore("checklist", { keyPath: "itemId" });
        const english = db.createObjectStore("englishTasks", { keyPath: "id" });
        english.createIndex("byAt", "at");
        db.createObjectStore("bookmarks", { keyPath: "questionId" });
        db.createObjectStore("dynamicAnswers", { keyPath: "questionId" });
        const outbox = db.createObjectStore("outbox", { keyPath: "eventId" });
        outbox.createIndex("byStatus", "status");
        db.createObjectStore("reports", { keyPath: "id" });
        db.createObjectStore("meta", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

/** Delete the whole local database (reset, sign-out cache purge, account deletion). */
export async function destroyDb(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}
