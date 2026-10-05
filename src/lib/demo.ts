"use client";
import { addDays } from "@/domain/dates";
import { createMock, answerMock, startMock } from "@/domain/mock";
import { seededRng } from "@/domain/rng";
import type { PracticeAttempt } from "@/domain/types";
import { getPack } from "./content";
import { getDb } from "./store/db";
import { notifyStoreChanged, nowIso } from "./store/events";
import { getProfile, recordAttempt, resetPractice, saveJourney, saveMock, setChecklist, setMeta, saveProfile, toggleBookmark } from "./store/repo";

/**
 * Fictional returning learner ("Amina" in the design). Loads illustrative history so the app's
 * returning states can be explored. Everything written here is flagged `illustrative` and the
 * Demo tag shows until it is cleared. Never mixed with a real learner's data: loading replaces
 * practice progress.
 */
export async function loadDemoLearner(today: string): Promise<void> {
  await resetPractice();
  const filing = addDays(today, -327); // ≈ Nov 12, 2025 when today is Oct 5, 2026
  await saveProfile({ filingDate: filing, filingDateUnknown: false, specialConsideration: false, state: "New York", onboarded: true });
  const pack = getPack("2025");
  const qs = pack.questions.filter((q) => !q.dynamic).slice(0, 10);
  const plan: Array<[number, Array<[number, "correct" | "incorrect" | "uncertain"]>]> = [
    [0, [[-12, "correct"], [-5, "correct"]]],
    [1, [[-9, "correct"], [-2, "uncertain"]]],
    [2, [[-10, "correct"], [-4, "correct"]]],
    [3, [[-8, "correct"], [-2, "incorrect"]]],
    [4, [[-2, "correct"]]],
    [5, [[-14, "correct"], [-7, "correct"]]],
    [6, [[-6, "correct"], [-3, "uncertain"]]],
    [7, [[-15, "correct"], [-6, "correct"]]],
    [8, [[-9, "correct"], [-4, "correct"]]],
    [9, [[-11, "correct"], [-5, "correct"]]],
  ];
  for (const [qi, attempts] of plan) {
    const q = qs[qi];
    for (const [dayOffset, outcome] of attempts) {
      const attempt: PracticeAttempt = { id: crypto.randomUUID(), questionId: q.id, bank: q.bank, packVersion: pack.version, outcome, method: "self-unprompted", prompted: false, context: "practice", at: `${addDays(today, dayOffset)}T15:00:00.000Z` };
      await recordAttempt(attempt);
    }
  }
  await toggleBookmark(qs[1].id);
  const dyn = pack.questions.find((q) => q.dynamic?.kind === "governor");
  if (dyn) await toggleBookmark(dyn.id);
  // Two finished walkthroughs.
  const pool = pack.questions.map((q) => ({ id: q.id, special: q.special, unscorable: Boolean(q.dynamic) }));
  for (const [offset, outcomes] of [[-2, ["correct", "uncertain", "correct", "incorrect", "correct"]], [-8, ["correct", "incorrect", "correct", "incorrect", "uncertain"]]] as const) {
    const at = `${addDays(today, offset)}T16:00:00.000Z`;
    let m = startMock(createMock({ id: crypto.randomUUID(), kind: "walkthrough", bank: "2025", packVersion: pack.version, special: false, pool, seed: Math.floor(seededRng(offset + 100)() * 1e9), now: at }), at);
    for (const o of outcomes) if (m.status === "active") m = answerMock(m, { outcome: o, method: "mock-self", prompted: false, at });
    await saveMock(m);
  }
  const db = await getDb();
  await db.put("englishTasks", { id: crypto.randomUUID(), kind: "reading", taskId: "r-01", outcome: "correct", text: "Read clearly (your own check)", selfReported: true, at: `${addDays(today, -2)}T17:00:00.000Z` });
  await db.put("englishTasks", { id: crypto.randomUUID(), kind: "writing", taskId: "w-01", outcome: "incorrect", text: "1 word different", selfReported: true, at: `${addDays(today, -4)}T17:00:00.000Z` });
  await saveJourney({
    receipt: { status: "done", date: addDays(filing, 12) },
    bio: { status: "attended", date: addDays(filing, 64) },
    interview: { status: "scheduled", date: addDays(today, 44) },
    outcome: { status: "none", date: "" },
    decision: { status: "none", date: "" },
    oath: { status: "none", date: "" },
  });
  for (const id of ["path", "exceptions", "recall", "weak", "routine"]) await setChecklist({ itemId: id, completedAt: nowIso(), remind: false });
  await setChecklist({ itemId: "notice", completedAt: null, remind: true });
  await setMeta("sessions", 6);
  await setMeta("illustrative", true);
  notifyStoreChanged();
}

export async function isDemoLoaded(): Promise<boolean> {
  const db = await getDb();
  return Boolean((await db.get("meta", "illustrative"))?.value);
}

export async function profileIsFresh(): Promise<boolean> {
  return !(await getProfile()).onboarded;
}
