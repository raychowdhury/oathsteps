import { sample, seededRng } from "./rng";
import { RULES, type MockRules } from "./testPath";
import type { AssessmentMethod, Bank, Instant, Outcome } from "./types";

export interface MockConfig {
  id: string;
  bank: Bank;
  packVersion: string;
  special: boolean;
  rules: MockRules;
  /** Ordered question ids selected for this session. */
  questionIds: string[];
  seed: number;
  createdAt: Instant;
}

export interface MockAnswer {
  questionId: string;
  outcome: Outcome;
  method: AssessmentMethod;
  prompted: boolean;
  at: Instant;
}

export interface MockResult {
  passed: boolean;
  correct: number;
  incorrect: number;
  uncertain: number;
  attempted: number;
  asked: number;
  pass: number;
  stoppedEarly: boolean;
  reason: "reached-pass" | "reached-fail" | "exhausted" | "abandoned";
  method: "self-assessed";
  missedQuestionIds: string[];
}

export type MockStatus = "configured" | "active" | "paused" | "finished";

export interface MockState {
  config: MockConfig;
  status: MockStatus;
  index: number;
  answers: MockAnswer[];
  result: MockResult | null;
  startedAt: Instant | null;
  finishedAt: Instant | null;
}

export interface Candidate {
  id: string;
  special: boolean;
  /** Dynamic question with no learner-confirmed answer: excluded, it cannot be scored honestly. */
  unscorable?: boolean;
}

export function selectQuestions(pool: readonly Candidate[], special: boolean, count: number, seed: number): string[] {
  const eligible = pool.filter((q) => (special ? q.special : true) && !q.unscorable);
  return sample(eligible.map((q) => q.id), count, seededRng(seed));
}

export function createMock(input: { id: string; bank: Bank; packVersion: string; special: boolean; pool: readonly Candidate[]; seed: number; now: Instant }): MockState {
  const rules = input.special ? RULES[input.bank].special : RULES[input.bank].standard;
  const questionIds = selectQuestions(input.pool, input.special, rules.asked, input.seed);
  if (questionIds.length === 0) throw new Error("No scorable questions available for this mock.");
  return {
    config: { id: input.id, bank: input.bank, packVersion: input.packVersion, special: input.special, rules, questionIds, seed: input.seed, createdAt: input.now },
    status: "configured",
    index: 0,
    answers: [],
    result: null,
    startedAt: null,
    finishedAt: null,
  };
}

export function startMock(state: MockState, now: Instant): MockState {
  if (state.status !== "configured") throw new Error(`Cannot start a mock in status ${state.status}`);
  return { ...state, status: "active", startedAt: now };
}

export function pauseMock(state: MockState): MockState {
  if (state.status !== "active") throw new Error(`Cannot pause a mock in status ${state.status}`);
  return { ...state, status: "paused" };
}

export function resumeMock(state: MockState): MockState {
  if (state.status !== "paused") throw new Error(`Cannot resume a mock in status ${state.status}`);
  return { ...state, status: "active" };
}

export function currentQuestionId(state: MockState): string | null {
  return state.status === "active" || state.status === "paused" ? (state.config.questionIds[state.index] ?? null) : null;
}

function tally(answers: MockAnswer[]) {
  let correct = 0,
    incorrect = 0,
    uncertain = 0;
  for (const a of answers) {
    if (a.outcome === "correct") correct++;
    else if (a.outcome === "incorrect") incorrect++;
    else uncertain++;
  }
  return { correct, incorrect, uncertain };
}

/**
 * Record an answer and apply the stopping rule. `uncertain` counts as not-correct for the
 * official-format result (the real test has no "uncertain") and is reported separately.
 */
export function answerMock(state: MockState, answer: Omit<MockAnswer, "questionId">): MockState {
  if (state.status !== "active") throw new Error(`Cannot answer in status ${state.status}`);
  const questionId = state.config.questionIds[state.index];
  if (!questionId) throw new Error("No current question");
  const answers = [...state.answers, { ...answer, questionId }];
  const { correct, incorrect, uncertain } = tally(answers);
  const { pass, stopIncorrect, asked } = state.config.rules;
  const notCorrect = incorrect + uncertain;
  const next = { ...state, answers, index: state.index + 1 };
  if (correct >= pass) return finish(next, "reached-pass", answer.at);
  if (notCorrect >= stopIncorrect) return finish(next, "reached-fail", answer.at);
  if (answers.length >= asked || next.index >= state.config.questionIds.length) return finish(next, "exhausted", answer.at);
  return next;
}

export function abandonMock(state: MockState, now: Instant): MockState {
  if (state.status === "finished") return state;
  return finish(state, "abandoned", now);
}

function finish(state: MockState, reason: MockResult["reason"], now: Instant): MockState {
  const { correct, incorrect, uncertain } = tally(state.answers);
  const { asked, pass } = state.config.rules;
  const result: MockResult = {
    passed: correct >= pass,
    correct,
    incorrect,
    uncertain,
    attempted: state.answers.length,
    asked,
    pass,
    stoppedEarly: reason !== "exhausted" && state.answers.length < asked,
    reason,
    method: "self-assessed",
    missedQuestionIds: state.answers.filter((a) => a.outcome !== "correct").map((a) => a.questionId),
  };
  return { ...state, status: "finished", result, finishedAt: now };
}

/** Human-readable practice-format summary (not a quotation of USCIS policy). */
export function describeRules(bank: Bank, special: boolean): string {
  const r = special ? RULES[bank].special : RULES[bank].standard;
  const bankLabel = special ? `the 20 designated 65/20 questions` : `the ${RULES[bank].bankSize}-question ${bank} bank`;
  return `Up to ${r.asked} questions from ${bankLabel}. ${r.pass} correct passes; the practice stops at ${r.pass} correct or ${r.stopIncorrect} incorrect.`;
}
