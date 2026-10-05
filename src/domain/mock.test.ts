import { describe, expect, it } from "vitest";
import { WALKTHROUGH_RULES, abandonMock, answerMock, createMock, currentQuestionId, describeRules, pauseMock, resumeMock, selectQuestions, startMock, type Candidate, type MockState } from "./mock";

const pool = (n: number, specialEvery = 5): Candidate[] => Array.from({ length: n }, (_, i) => ({ id: `q-${i + 1}`, special: (i + 1) % specialEvery === 0 }));
const T = "2026-01-10T10:00:00Z";
const self = { method: "mock-self" as const, prompted: false, at: T };

function run(state: MockState, outcomes: Array<"correct" | "incorrect" | "uncertain">) {
  let s = startMock(state, T);
  for (const o of outcomes) {
    if (s.status !== "active") break;
    s = answerMock(s, { ...self, outcome: o });
  }
  return s;
}

describe("question selection", () => {
  it("is deterministic for a seed and excludes unscorable questions", () => {
    const p = [...pool(30), { id: "dyn", special: false, unscorable: true }];
    const a = selectQuestions(p, false, 20, 42);
    const b = selectQuestions(p, false, 20, 42);
    expect(a).toEqual(b);
    expect(a).toHaveLength(20);
    expect(new Set(a).size).toBe(20);
    expect(a).not.toContain("dyn");
    expect(selectQuestions(p, false, 20, 43)).not.toEqual(a);
  });

  it("restricts 65/20 mocks to the designated questions", () => {
    const ids = selectQuestions(pool(128, 6), true, 10, 1);
    expect(ids).toHaveLength(10);
    expect(ids.every((id) => Number(id.slice(2)) % 6 === 0)).toBe(true);
  });
});

describe("2025 mock (20 asked, 12 to pass, stop at 9 incorrect)", () => {
  const make = () => createMock({ id: "m1", bank: "2025", packVersion: "2025.test", special: false, pool: pool(128), seed: 7, now: T });

  it("stops early with a pass at 12 correct", () => {
    const s = run(make(), Array(12).fill("correct"));
    expect(s.status).toBe("finished");
    expect(s.result).toMatchObject({ passed: true, correct: 12, attempted: 12, stoppedEarly: true, reason: "reached-pass", asked: 20, pass: 12 });
  });

  it("stops early with a fail at 9 incorrect", () => {
    const s = run(make(), [...Array(8).fill("correct"), ...Array(9).fill("incorrect")]);
    expect(s.result).toMatchObject({ passed: false, correct: 8, incorrect: 9, attempted: 17, stoppedEarly: true, reason: "reached-fail" });
    expect(s.result?.missedQuestionIds).toHaveLength(9);
  });

  it("counts uncertain as not-correct for stopping and reports it separately", () => {
    const s = run(make(), [...Array(5).fill("incorrect"), ...Array(4).fill("uncertain")]);
    expect(s.result).toMatchObject({ passed: false, incorrect: 5, uncertain: 4, reason: "reached-fail" });
  });

  it("stays active at 19 answers and lets the 20th decide (20 asked can never end undecided)", () => {
    const s = run(make(), [...Array(11).fill("correct"), ...Array(8).fill("incorrect")]);
    expect(s.status).toBe("active");
    expect(s.index).toBe(19);
    const failed = answerMock(s, { ...self, outcome: "uncertain" });
    expect(failed.result).toMatchObject({ attempted: 20, passed: false, reason: "reached-fail", uncertain: 1 });
    const passed = answerMock(s, { ...self, outcome: "correct" });
    expect(passed.result).toMatchObject({ attempted: 20, passed: true, reason: "reached-pass", stoppedEarly: false });
  });

  it("reports exhausted when the pool is shorter than the asked count", () => {
    const short = createMock({ id: "m-short", bank: "2025", packVersion: "2025.test", special: false, pool: pool(5), seed: 1, now: T });
    const s = run(short, Array(5).fill("correct"));
    expect(s.result).toMatchObject({ attempted: 5, passed: false, reason: "exhausted" });
  });

  it("supports pause and resume without losing answers", () => {
    let s = startMock(make(), T);
    s = answerMock(s, { ...self, outcome: "correct" });
    s = pauseMock(s);
    expect(s.status).toBe("paused");
    expect(() => answerMock(s, { ...self, outcome: "correct" })).toThrow();
    s = resumeMock(s);
    expect(s.answers).toHaveLength(1);
    expect(currentQuestionId(s)).toBe(s.config.questionIds[1]);
  });

  it("records an abandoned session honestly", () => {
    let s = startMock(make(), T);
    s = answerMock(s, { ...self, outcome: "correct" });
    s = abandonMock(s, T);
    expect(s.result).toMatchObject({ reason: "abandoned", attempted: 1, passed: false });
  });
});

describe("2008 and 65/20 mocks (10 asked, 6 to pass, stop at 5 incorrect)", () => {
  it("passes at 6 correct", () => {
    const s = run(createMock({ id: "m2", bank: "2008", packVersion: "2008.test", special: false, pool: pool(100), seed: 3, now: T }), Array(6).fill("correct"));
    expect(s.result).toMatchObject({ passed: true, attempted: 6, asked: 10, pass: 6, reason: "reached-pass" });
  });

  it("fails at 5 incorrect", () => {
    const s = run(createMock({ id: "m3", bank: "2008", packVersion: "2008.test", special: false, pool: pool(100), seed: 3, now: T }), ["correct", ...Array(5).fill("incorrect")]);
    expect(s.result).toMatchObject({ passed: false, attempted: 6, reason: "reached-fail" });
  });

  it("uses the special rules for 65/20 on the 2025 bank", () => {
    const m = createMock({ id: "m4", bank: "2025", packVersion: "2025.test", special: true, pool: pool(128, 6), seed: 9, now: T });
    expect(m.config.rules).toEqual({ asked: 10, pass: 6, stopIncorrect: 5 });
    expect(m.config.questionIds).toHaveLength(10);
    expect(describeRules("2025", true)).toMatch(/20 designated/);
  });

  it("refuses to start with nothing scorable", () => {
    expect(() => createMock({ id: "m5", bank: "2008", packVersion: "x", special: false, pool: [{ id: "a", special: false, unscorable: true }], seed: 1, now: T })).toThrow();
  });
});

describe("sample walkthrough (5 asked, 4 to pass, stop at 3 wrong)", () => {
  const make = () => createMock({ id: "w1", kind: "walkthrough", bank: "2025", packVersion: "2025.test", special: false, pool: pool(128), seed: 2, now: T });
  it("uses the scaled rule and five questions", () => {
    expect(WALKTHROUGH_RULES).toEqual({ asked: 5, pass: 4, stopIncorrect: 3 });
    expect(make().config.questionIds).toHaveLength(5);
    expect(make().config.kind).toBe("walkthrough");
  });
  it("stops at 4 correct", () => {
    expect(run(make(), Array(4).fill("correct")).result).toMatchObject({ passed: true, attempted: 4, reason: "reached-pass" });
  });
  it("stops at 3 wrong, counting unsure as wrong", () => {
    expect(run(make(), ["correct", "incorrect", "uncertain", "incorrect"]).result).toMatchObject({ passed: false, attempted: 4, reason: "reached-fail", uncertain: 1 });
  });
  it("asks all five when undecided", () => {
    expect(run(make(), ["correct", "incorrect", "correct", "incorrect", "correct"]).result).toMatchObject({ attempted: 5, passed: false, reason: "exhausted", correct: 3 });
    expect(run(make(), ["correct", "incorrect", "correct", "uncertain", "correct"]).result).toMatchObject({ attempted: 5, passed: false, reason: "exhausted", uncertain: 1 });
  });
});
