/** Domain types shared by the learning logic. No UI or storage imports here. */

export type Bank = "2008" | "2025";
/** Calendar date without time, formatted YYYY-MM-DD. Filing and appointment dates are date-only. */
export type DateOnly = string;
/** ISO-8601 instant. */
export type Instant = string;

export type Outcome = "correct" | "incorrect" | "uncertain";
/** How an outcome was obtained. Only `self-unprompted` counts as independent oral recall. */
export type AssessmentMethod = "self-unprompted" | "self-hinted" | "multiple-choice" | "mock-self" | "typed-match" | "voice-self";

export type PracticeContext = "practice" | "review" | "mock" | "topic" | "voice";

export interface PracticeAttempt {
  /** Client-generated UUID. Duplicate submits reuse the same id and are stored once. */
  id: string;
  questionId: string;
  bank: Bank;
  packVersion: string;
  outcome: Outcome;
  method: AssessmentMethod;
  /** Answer was visible or a hint/choices were shown before the learner committed. */
  prompted: boolean;
  context: PracticeContext;
  mockId?: string;
  at: Instant;
}

export interface ReviewState {
  questionId: string;
  bank: Bank;
  /** 0..5 ladder position; see scheduler.ts for the interval table. */
  box: number;
  dueOn: DateOnly;
  lastOutcome?: Outcome;
  lastAt?: Instant;
  lastAttemptId?: string;
  /** Instants of unprompted correct answers, used for the delayed-recall indicator. */
  unpromptedCorrectAt: Instant[];
  seenCount: number;
}

export interface ChecklistEntry {
  itemId: string;
  completedAt: Instant | null;
  /** "Remind me" switch on a guide task; shown as a study reminder in the app. */
  remind: boolean;
}

export interface EnglishTaskRecord {
  id: string;
  kind: "reading" | "writing";
  taskId: string;
  outcome: Outcome;
  /** Short learner-facing summary, e.g. "Read clearly (your own check)" or "1 word different". */
  text: string;
  selfReported: true;
  at: Instant;
}

export interface StudyProfile {
  id: "local";
  filingDate: DateOnly | null;
  filingDateUnknown: boolean;
  /** Learner says the 65/20 special consideration may apply. Not a determination. */
  specialConsideration: boolean;
  state: string | null;
  textSize: "normal" | "large" | "xlarge";
  /** Appearance. "system" follows the device setting. */
  theme: "system" | "light" | "dark";
  /** Browser speech rate: 0.8 slower, 1 normal, 1.2 faster. */
  audioRate: number;
  reduceMotion: boolean;
  /** Practice answer mode. Multiple choice never counts as recall. */
  mode: "recall" | "choice";
  /** Read questions aloud automatically when a card opens. */
  autoplay: boolean;
  reminders: { study: boolean; daily: boolean; review: boolean; appointments: boolean; quietFrom: number; quietTo: number };
  createdAt: Instant;
  updatedAt: Instant;
  onboarded: boolean;
}

export interface ConfirmedDynamicAnswer {
  questionId: string;
  answer: string;
  region: string;
  confirmedOn: DateOnly;
  sourceUrl: string;
}
