import { describe, expect, it } from "vitest";
import { applyAttempt, dueToday, INTERVAL_DAYS, isSecure, isWeak, newReviewState } from "./scheduler";
import type { PracticeAttempt, ReviewState } from "./types";

const attempt = (over: Partial<PracticeAttempt>): PracticeAttempt => ({
  id: over.id ?? crypto.randomUUID(),
  questionId: "2025-001",
  bank: "2025",
  packVersion: "2025.test",
  outcome: "correct",
  method: "self-unprompted",
  prompted: false,
  context: "practice",
  at: "2026-01-10T15:00:00Z",
  ...over,
});

describe("review scheduler", () => {
  const start = newReviewState("2025-001", "2025", "2026-01-10");

  it("advances one box per unprompted correct answer and schedules by the ladder", () => {
    let s = applyAttempt(start, attempt({ id: "a1" }), "UTC");
    expect(s.box).toBe(1);
    expect(s.dueOn).toBe("2026-01-11");
    s = applyAttempt(s, attempt({ id: "a2", at: "2026-01-11T15:00:00Z" }), "UTC");
    expect(s.box).toBe(2);
    expect(s.dueOn).toBe("2026-01-14");
    expect(INTERVAL_DAYS[2]).toBe(3);
  });

  it("does not advance mastery for hinted or multiple-choice recognition", () => {
    const hinted = applyAttempt(start, attempt({ id: "h1", method: "self-hinted", prompted: true }), "UTC");
    expect(hinted.box).toBe(0);
    expect(hinted.dueOn).toBe("2026-01-11");
    expect(hinted.unpromptedCorrectAt).toEqual([]);
    const mc = applyAttempt(start, attempt({ id: "m1", method: "multiple-choice", prompted: true }), "UTC");
    expect(mc.box).toBe(0);
  });

  it("demotes on uncertain and resets on incorrect", () => {
    let s = { ...start, box: 3 } as ReviewState;
    s = applyAttempt(s, attempt({ id: "u1", outcome: "uncertain" }), "UTC");
    expect(s.box).toBe(2);
    expect(s.dueOn).toBe("2026-01-11");
    s = applyAttempt(s, attempt({ id: "i1", outcome: "incorrect", at: "2026-01-11T09:00:00Z" }), "UTC");
    expect(s.box).toBe(0);
    expect(s.dueOn).toBe("2026-01-11");
    expect(isWeak(s)).toBe(true);
  });

  it("ignores a duplicate submit of the same attempt id", () => {
    const a = attempt({ id: "dup" });
    const once = applyAttempt(start, a, "UTC");
    const twice = applyAttempt(once, a, "UTC");
    expect(twice).toEqual(once);
    expect(twice.seenCount).toBe(1);
  });

  it("caps the box and uses the learner's time zone for the due date", () => {
    let s = { ...start, box: 5 } as ReviewState;
    s = applyAttempt(s, attempt({ id: "c1", at: "2026-01-11T03:00:00Z" }), "America/Los_Angeles"); // Jan 10 local
    expect(s.box).toBe(5);
    expect(s.dueOn).toBe("2026-02-09");
  });

  it("treats two unprompted correct answers 24h apart as secure recall", () => {
    let s = applyAttempt(start, attempt({ id: "s1", at: "2026-01-10T15:00:00Z" }), "UTC");
    expect(isSecure(s)).toBe(false);
    s = applyAttempt(s, attempt({ id: "s2", at: "2026-01-11T14:00:00Z" }), "UTC");
    expect(isSecure(s)).toBe(false); // 23h
    s = applyAttempt(s, attempt({ id: "s3", at: "2026-01-11T15:00:00Z" }), "UTC");
    expect(isSecure(s)).toBe(true);
  });

  it("returns a capped, most-overdue-first catch-up after missed days", () => {
    const states: ReviewState[] = Array.from({ length: 30 }, (_, i) => ({ ...newReviewState(`q${i}`, "2025", "2026-01-01"), seenCount: 1, dueOn: `2026-01-${String(1 + (i % 10)).padStart(2, "0")}` }));
    const { due, deferred } = dueToday(states, "2026-01-12", 15);
    expect(due).toHaveLength(15);
    expect(deferred).toBe(15);
    expect(due[0].dueOn).toBe("2026-01-01");
    const unseen = dueToday([newReviewState("new", "2025", "2026-01-01")], "2026-01-12", 15);
    expect(unseen.due).toHaveLength(0);
  });
});
