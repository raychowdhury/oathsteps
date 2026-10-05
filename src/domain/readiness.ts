import { hoursBetween } from "./dates";
import type { MockResult } from "./mock";
import { SECURE_RECALL_GAP_HOURS } from "./scheduler";
import type { EnglishTaskRecord, Instant, PracticeAttempt, ReviewState } from "./types";

export interface MockSummary {
  id: string;
  finishedAt: Instant;
  result: MockResult;
  bank: string;
  special: boolean;
}

export interface ReadinessInput {
  bankQuestionIds: readonly string[];
  attempts: readonly PracticeAttempt[];
  reviewStates: readonly ReviewState[];
  mocks: readonly MockSummary[];
  englishTasks: readonly EnglishTaskRecord[];
  /** Questions that still have no learner-confirmed dynamic answer. */
  unconfirmedDynamicIds: readonly string[];
}

export interface Readiness {
  /** Below this many attempts the indicators are an explicit empty state. */
  hasEnoughHistory: boolean;
  minimumAttempts: number;
  coverage: { encountered: number; bankSize: number; definition: string };
  delayedRecall: { numerator: number; denominator: number; delayHours: number; method: string; definition: string; lastEvidenceAt: Instant | null };
  recentMocks: { items: MockSummary[]; definition: string };
  english: { byKind: Record<EnglishTaskRecord["kind"], { attempted: number; correct: number }>; selfReported: true; definition: string };
  uncertain: { questionIds: string[]; definition: string };
  unconfirmedDynamic: { questionIds: string[]; definition: string };
  recommendations: string[];
}

export const MINIMUM_ATTEMPTS = 10;

export function computeReadiness(input: ReadinessInput): Readiness {
  const bank = new Set(input.bankQuestionIds);
  const attempts = input.attempts.filter((a) => bank.has(a.questionId));
  const encountered = new Set(attempts.map((a) => a.questionId)).size;

  // Delayed recall: eligible = questions with ≥2 unprompted self attempts where the latest came
  // ≥ SECURE_RECALL_GAP_HOURS after the first. Numerator = those whose latest such attempt was correct.
  let numerator = 0,
    denominator = 0,
    lastEvidenceAt: Instant | null = null;
  const byQuestion = new Map<string, PracticeAttempt[]>();
  for (const a of attempts) {
    if (a.method !== "self-unprompted" || a.prompted) continue;
    byQuestion.set(a.questionId, [...(byQuestion.get(a.questionId) ?? []), a]);
  }
  for (const list of byQuestion.values()) {
    list.sort((a, b) => a.at.localeCompare(b.at));
    const first = list[0];
    const delayed = list.filter((a) => hoursBetween(first.at, a.at) >= SECURE_RECALL_GAP_HOURS);
    if (!delayed.length) continue;
    denominator++;
    const latest = delayed[delayed.length - 1];
    if (latest.outcome === "correct") numerator++;
    if (!lastEvidenceAt || latest.at > lastEvidenceAt) lastEvidenceAt = latest.at;
  }

  const kinds: EnglishTaskRecord["kind"][] = ["reading", "writing", "instructions", "n400-vocabulary", "conversation"];
  const byKind = Object.fromEntries(kinds.map((k) => [k, { attempted: 0, correct: 0 }])) as Readiness["english"]["byKind"];
  for (const t of input.englishTasks) {
    byKind[t.kind].attempted++;
    if (t.outcome === "correct") byKind[t.kind].correct++;
  }

  const uncertainIds = input.reviewStates.filter((s) => bank.has(s.questionId) && s.lastOutcome === "uncertain").map((s) => s.questionId);
  const recentMocks = [...input.mocks].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)).slice(0, 3);
  const hasEnoughHistory = attempts.length >= MINIMUM_ATTEMPTS;

  const recommendations: string[] = [];
  if (!hasEnoughHistory) recommendations.push(`Practice at least ${MINIMUM_ATTEMPTS - attempts.length} more card${MINIMUM_ATTEMPTS - attempts.length === 1 ? "" : "s"} so there is enough history to show meaningful indicators.`);
  if (uncertainIds.length) recommendations.push(`Retry the ${uncertainIds.length} answer${uncertainIds.length === 1 ? "" : "s"} you marked uncertain.`);
  if (hasEnoughHistory && encountered < bank.size) recommendations.push(`${bank.size - encountered} questions in your bank have not been practiced yet.`);
  if (hasEnoughHistory && denominator === 0) recommendations.push("Come back tomorrow and answer today's questions again without hints to build delayed-recall evidence.");
  if (input.unconfirmedDynamicIds.length) recommendations.push(`Confirm the ${input.unconfirmedDynamicIds.length} answers that depend on current officials or your state.`);
  if (hasEnoughHistory && recentMocks.length === 0) recommendations.push("Take a mock test to practice the real format.");
  const weakEnglish = kinds.filter((k) => byKind[k].attempted === 0);
  if (hasEnoughHistory && weakEnglish.length) recommendations.push(`Try an English task you have not done yet: ${weakEnglish.join(", ")}.`);

  return {
    hasEnoughHistory,
    minimumAttempts: MINIMUM_ATTEMPTS,
    coverage: { encountered, bankSize: bank.size, definition: "Questions in your applicable bank that you have practiced at least once. Exposure is not mastery." },
    delayedRecall: {
      numerator,
      denominator,
      delayHours: SECURE_RECALL_GAP_HOURS,
      method: "self-assessed, unprompted",
      definition: `Questions answered without hints on a later day (at least ${SECURE_RECALL_GAP_HOURS} hours after the first unprompted attempt), and how many of those latest delayed attempts you marked correct.`,
      lastEvidenceAt,
    },
    recentMocks: { items: recentMocks, definition: "Your last three mock results with dates and how many questions were attempted. A small history is not a probability of passing." },
    english: { byKind, selfReported: true, definition: "English tasks you completed and self-assessed. This is not an official English score." },
    uncertain: { questionIds: uncertainIds, definition: "Answers you marked uncertain the last time. They need another attempt, not an automatic failure." },
    unconfirmedDynamic: { questionIds: [...input.unconfirmedDynamicIds], definition: "Questions whose answer depends on current officials or your state. Confirm them from an official source." },
    recommendations,
  };
}
