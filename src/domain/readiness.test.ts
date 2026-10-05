import { describe, expect, it } from "vitest";
import { computeReadiness, MINIMUM_ATTEMPTS } from "./readiness";
import { newReviewState } from "./scheduler";
import type { PracticeAttempt } from "./types";

const bank = Array.from({ length: 10 }, (_, i) => `q${i + 1}`);
const att = (questionId: string, at: string, over: Partial<PracticeAttempt> = {}): PracticeAttempt => ({ id: crypto.randomUUID(), questionId, bank: "2025", packVersion: "v", outcome: "correct", method: "self-unprompted", prompted: false, context: "practice", at, ...over });

describe("readiness", () => {
  it("is an explicit empty state with too little history", () => {
    const r = computeReadiness({ bankQuestionIds: bank, attempts: [att("q1", "2026-01-01T10:00:00Z")], reviewStates: [], mocks: [], englishTasks: [], unconfirmedDynamicIds: [] });
    expect(r.hasEnoughHistory).toBe(false);
    expect(r.recommendations[0]).toMatch(new RegExp(`${MINIMUM_ATTEMPTS - 1} more`));
    expect(r.coverage).toMatchObject({ encountered: 1, bankSize: 10 });
  });

  it("computes delayed unprompted recall with numerator, denominator and method", () => {
    const attempts = [
      ...bank.map((q) => att(q, "2026-01-01T10:00:00Z")),
      att("q1", "2026-01-02T11:00:00Z"), // ≥24h later, correct
      att("q2", "2026-01-02T11:00:00Z", { outcome: "incorrect" }),
      att("q3", "2026-01-01T20:00:00Z"), // same day, not delayed
      att("q4", "2026-01-03T11:00:00Z", { method: "multiple-choice", prompted: true }), // excluded
    ];
    const r = computeReadiness({ bankQuestionIds: bank, attempts, reviewStates: [], mocks: [], englishTasks: [], unconfirmedDynamicIds: ["q9"] });
    expect(r.hasEnoughHistory).toBe(true);
    expect(r.delayedRecall).toMatchObject({ numerator: 1, denominator: 2, delayHours: 24, method: "self-assessed, unprompted", lastEvidenceAt: "2026-01-02T11:00:00Z" });
    expect(r.coverage.encountered).toBe(10);
    expect(r.unconfirmedDynamic.questionIds).toEqual(["q9"]);
    expect(r.recommendations.join(" ")).toMatch(/Take a mock/);
  });

  it("lists uncertain questions and the last three mocks", () => {
    const states = [{ ...newReviewState("q5", "2025", "2026-01-01"), seenCount: 1, lastOutcome: "uncertain" as const }];
    const mock = (id: string, finishedAt: string) => ({ id, finishedAt, bank: "2025", special: false, result: { passed: false, correct: 3, incorrect: 2, uncertain: 0, attempted: 5, asked: 20, pass: 12, stoppedEarly: true, reason: "abandoned" as const, method: "self-assessed" as const, missedQuestionIds: [] } });
    const r = computeReadiness({ bankQuestionIds: bank, attempts: bank.map((q) => att(q, "2026-01-01T10:00:00Z")), reviewStates: states, mocks: [mock("a", "2026-01-01T00:00:00Z"), mock("b", "2026-01-04T00:00:00Z"), mock("c", "2026-01-02T00:00:00Z"), mock("d", "2026-01-03T00:00:00Z")], englishTasks: [{ id: "e1", kind: "reading", taskId: "r1", outcome: "correct", selfReported: true, at: "2026-01-01T00:00:00Z" }], unconfirmedDynamicIds: [] });
    expect(r.uncertain.questionIds).toEqual(["q5"]);
    expect(r.recentMocks.items.map((m) => m.id)).toEqual(["b", "d", "c"]);
    expect(r.english.byKind.reading).toEqual({ attempted: 1, correct: 1 });
    expect(r.english.selfReported).toBe(true);
  });
});
