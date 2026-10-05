/** Domain types shared by the learning logic. No UI or storage imports here. */

export type Bank = "2008" | "2025";
/** Calendar date without time, formatted YYYY-MM-DD. Filing and appointment dates are date-only. */
export type DateOnly = string;
/** ISO-8601 instant. */
export type Instant = string;

export type Outcome = "correct" | "incorrect" | "uncertain";
/** How an outcome was obtained. Only `self-unprompted` counts as independent oral recall. */
export type AssessmentMethod = "self-unprompted" | "self-hinted" | "multiple-choice" | "mock-self";

export type PracticeContext = "practice" | "review" | "mock" | "topic";

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

export type MilestoneKind =
  | "filed"
  | "receipt"
  | "biometrics-attended"
  | "biometrics-reused"
  | "interview"
  | "interview-continued"
  | "retest"
  | "evidence-requested"
  | "decision-approved"
  | "decision-denied"
  | "oath";

export interface Milestone {
  id: string;
  kind: MilestoneKind;
  /** Date the event happened or is scheduled. User-entered. */
  date: DateOnly | null;
  /** For scheduled items that moved. */
  rescheduledFrom?: DateOnly | null;
  note?: string;
  /** Always "user" in this release; a later approved integration would add "official". */
  provenance: "user";
  createdAt: Instant;
  updatedAt: Instant;
}

export interface ChecklistEntry {
  itemId: string;
  completedAt: Instant | null;
  reminderOn: DateOnly | null;
}

export interface EnglishTaskRecord {
  id: string;
  kind: "reading" | "writing" | "instructions" | "n400-vocabulary" | "conversation";
  taskId: string;
  outcome: Outcome;
  selfReported: true;
  at: Instant;
}

export interface StudyProfile {
  id: "local";
  filingDate: DateOnly | null;
  filingDateUnknown: boolean;
  /** Learner-chosen bank when the filing date is unknown. Labeled provisional in the UI. */
  provisionalBank: Bank | null;
  /** Learner says the 65/20 special consideration may apply. Not a determination. */
  specialConsideration: boolean;
  state: string | null;
  interviewDate: DateOnly | null;
  studyDeadline: DateOnly | null;
  textSize: "normal" | "large" | "xlarge";
  audioRate: number;
  audioAutoplay: boolean;
  reduceMotion: boolean;
  newPerDay: number;
  reminders: { study: boolean; appointments: boolean; checklist: boolean };
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
