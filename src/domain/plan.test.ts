import { describe, expect, it } from "vitest";
import { buildDailyPlan } from "./plan";
import { newReviewState } from "./scheduler";

const bank = Array.from({ length: 20 }, (_, i) => `q${i + 1}`);

describe("daily plan", () => {
  it("gives a first-time learner only new questions and a task", () => {
    const plan = buildDailyPlan({ today: "2026-01-10", bankQuestionIds: bank, reviewStates: [], newPerDay: 5, practicalTask: { itemId: "t", text: "Read your notice", stageTitle: "Interview preparation" } });
    expect(plan.isFirstSession).toBe(true);
    expect(plan.newIds).toEqual(["q1", "q2", "q3", "q4", "q5"]);
    expect(plan.reviewIds).toEqual([]);
    expect(plan.estimatedMinutes).toBe(6);
    expect(plan.reasons.join(" ")).toMatch(/new question/);
  });

  it("puts due reviews first, defers the overflow and skips seen questions as new", () => {
    const states = bank.slice(0, 18).map((id, i) => ({ ...newReviewState(id, "2025", "2026-01-01"), seenCount: 1, dueOn: i < 16 ? "2026-01-05" : "2026-02-01" }));
    const plan = buildDailyPlan({ today: "2026-01-10", bankQuestionIds: bank, reviewStates: states, newPerDay: 5, maxReview: 10, practicalTask: null });
    expect(plan.reviewIds).toHaveLength(10);
    expect(plan.deferredReview).toBe(6);
    expect(plan.newIds).toEqual(["q19", "q20"]);
    expect(plan.isFirstSession).toBe(false);
    expect(plan.reasons.join(" ")).toMatch(/waiting/);
  });

  it("says so when nothing is due", () => {
    const states = bank.map((id) => ({ ...newReviewState(id, "2025", "2026-01-01"), seenCount: 3, dueOn: "2026-03-01" }));
    const plan = buildDailyPlan({ today: "2026-01-10", bankQuestionIds: bank, reviewStates: states, newPerDay: 5, practicalTask: null });
    expect(plan.reviewIds).toEqual([]);
    expect(plan.newIds).toEqual([]);
    expect(plan.reasons[0]).toMatch(/Nothing is due/);
  });
});
