import { addDays, compareDateOnly, daysBetween, hoursBetween, instantToDateOnly } from "./dates";
import type { DateOnly, PracticeAttempt, ReviewState } from "./types";

/**
 * Review ladder. A question sits in a box; each unprompted correct answer moves it up one box
 * and schedules the next review after INTERVAL_DAYS[box] days. Deliberately simple and
 * fully documented so learners can be told exactly why something is due.
 *
 *  box:        0  1  2  3   4   5
 *  interval:   0  1  3  7  14  30 days
 */
export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30] as const;
export const MAX_BOX = INTERVAL_DAYS.length - 1;

/** Two unprompted correct answers at least this far apart count as secure recall (engineering hypothesis, not a USCIS standard). */
export const SECURE_RECALL_GAP_HOURS = 24;

export function newReviewState(questionId: string, bank: ReviewState["bank"], today: DateOnly): ReviewState {
  return { questionId, bank, box: 0, dueOn: today, unpromptedCorrectAt: [], seenCount: 0 };
}

/**
 * Apply one attempt to the review state. Pure; idempotent per attempt id.
 * - unprompted correct   → box + 1, due after the box interval
 * - prompted/MC correct  → box unchanged, due tomorrow (needs unprompted confirmation)
 * - uncertain            → box - 1 (min 0), due tomorrow
 * - incorrect            → box 0, due today
 */
export function applyAttempt(state: ReviewState, attempt: PracticeAttempt, timeZone?: string): ReviewState {
  if (state.lastAttemptId === attempt.id) return state;
  const today = instantToDateOnly(attempt.at, timeZone);
  let box = state.box;
  let dueOn: DateOnly;
  const unpromptedCorrectAt = state.unpromptedCorrectAt.slice();
  if (attempt.outcome === "correct" && attempt.method === "self-unprompted" && !attempt.prompted) {
    box = Math.min(MAX_BOX, box + 1);
    dueOn = addDays(today, INTERVAL_DAYS[box]);
    unpromptedCorrectAt.push(attempt.at);
  } else if (attempt.outcome === "correct") {
    dueOn = addDays(today, 1);
  } else if (attempt.outcome === "uncertain") {
    box = Math.max(0, box - 1);
    dueOn = addDays(today, 1);
  } else {
    box = 0;
    dueOn = today;
  }
  return { ...state, box, dueOn, lastOutcome: attempt.outcome, lastAt: attempt.at, lastAttemptId: attempt.id, unpromptedCorrectAt, seenCount: state.seenCount + 1 };
}

export function isDue(state: ReviewState, today: DateOnly): boolean {
  return compareDateOnly(state.dueOn, today) <= 0;
}

export function overdueDays(state: ReviewState, today: DateOnly): number {
  return Math.max(0, daysBetween(state.dueOn, today));
}

/** Weak = answered at least once and not currently above box 1, or last outcome not correct. */
export function isWeak(state: ReviewState): boolean {
  return state.seenCount > 0 && (state.box <= 1 || state.lastOutcome !== "correct");
}

export function isSecure(state: ReviewState): boolean {
  const at = state.unpromptedCorrectAt;
  if (at.length < 2) return false;
  return hoursBetween(at[0], at[at.length - 1]) >= SECURE_RECALL_GAP_HOURS;
}

/**
 * Due items for today, most overdue first, capped so a missed week is a short catch-up, not a wall.
 * The remainder is reported as deferred so the UI can say "and N more later".
 */
export function dueToday(states: readonly ReviewState[], today: DateOnly, cap: number): { due: ReviewState[]; deferred: number } {
  const all = states.filter((s) => s.seenCount > 0 && isDue(s, today)).sort((a, b) => overdueDays(b, today) - overdueDays(a, today) || a.box - b.box);
  return { due: all.slice(0, cap), deferred: Math.max(0, all.length - cap) };
}
