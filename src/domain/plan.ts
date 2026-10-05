import { dueToday } from "./scheduler";
import type { DateOnly, ReviewState } from "./types";

export interface PlanInput {
  today: DateOnly;
  /** Question ids in the learner's applicable bank, in official order. */
  bankQuestionIds: readonly string[];
  reviewStates: readonly ReviewState[];
  newPerDay: number;
  maxReview?: number;
  /** First incomplete guide item for the learner's current stage, if any. */
  practicalTask: { itemId: string; text: string; stageTitle: string } | null;
}

export interface DailyPlan {
  reviewIds: string[];
  deferredReview: number;
  newIds: string[];
  practicalTask: PlanInput["practicalTask"];
  /** Rough minutes, 30 s per card plus 3 min for a task. */
  estimatedMinutes: number;
  /** Why these items, in learner language. */
  reasons: string[];
  isFirstSession: boolean;
}

export const DEFAULT_MAX_REVIEW = 15;

export function buildDailyPlan(input: PlanInput): DailyPlan {
  const maxReview = input.maxReview ?? DEFAULT_MAX_REVIEW;
  const seen = new Set(input.reviewStates.filter((s) => s.seenCount > 0).map((s) => s.questionId));
  const inBank = new Set(input.bankQuestionIds);
  const { due, deferred } = dueToday(input.reviewStates.filter((s) => inBank.has(s.questionId)), input.today, maxReview);
  const newIds = input.bankQuestionIds.filter((id) => !seen.has(id)).slice(0, Math.max(0, input.newPerDay));
  const cards = due.length + newIds.length;
  const reasons: string[] = [];
  if (due.length) reasons.push(`${due.length} answer${due.length === 1 ? "" : "s"} ${due.length === 1 ? "is" : "are"} due for review because the last check was a while ago or was shaky.`);
  if (deferred) reasons.push(`${deferred} more are waiting; they will come up over the next days so today stays short.`);
  if (newIds.length) reasons.push(`${newIds.length} new question${newIds.length === 1 ? "" : "s"} keep you moving through the bank.`);
  if (input.practicalTask) reasons.push(`One practical task from the ${input.practicalTask.stageTitle} stage of your journey.`);
  if (!cards && !input.practicalTask) reasons.push("Nothing is due. Browse topics or take a mock if you want more practice.");
  return {
    reviewIds: due.map((s) => s.questionId),
    deferredReview: deferred,
    newIds,
    practicalTask: input.practicalTask,
    estimatedMinutes: Math.ceil(cards * 0.5) + (input.practicalTask ? 3 : 0),
    reasons,
    isFirstSession: seen.size === 0,
  };
}
