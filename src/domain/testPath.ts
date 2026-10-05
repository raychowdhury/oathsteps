import { compareDateOnly, isValidDateOnly } from "./dates";
import type { Bank, DateOnly } from "./types";

/** Form N-400 filed on or after this date takes the 2025 civics test (Federal Register 2025-18050). */
export const CUTOVER_DATE: DateOnly = "2025-10-20";

export interface MockRules {
  /** Maximum questions asked. */
  asked: number;
  /** Correct answers needed to pass; the interview stops once reached. */
  pass: number;
  /** Incorrect answers at which the interview stops with a fail. */
  stopIncorrect: number;
}

/** Mirrors content/packs/*.json `rules`. Kept here so routing is pure and testable. */
export const RULES: Record<Bank, { standard: MockRules; special: MockRules; bankSize: number; specialSize: number }> = {
  "2008": { standard: { asked: 10, pass: 6, stopIncorrect: 5 }, special: { asked: 10, pass: 6, stopIncorrect: 5 }, bankSize: 100, specialSize: 20 },
  "2025": { standard: { asked: 20, pass: 12, stopIncorrect: 9 }, special: { asked: 10, pass: 6, stopIncorrect: 5 }, bankSize: 128, specialSize: 20 },
};

export interface PathInput {
  filingDate: DateOnly | null;
  /** Learner chose a bank to study while the filing date is unknown. */
  provisionalBank?: Bank | null;
  /** Learner indicated 65/20 may apply. The app never determines eligibility. */
  specialConsideration?: boolean;
}

export interface TestPath {
  status: "determined" | "provisional" | "unknown";
  bank: Bank | null;
  special: boolean;
  rules: MockRules | null;
  /** Plain-language reason shown to the learner. */
  explanation: string;
  basis: "filing-date" | "learner-choice" | "none";
}

export function bankForFilingDate(filingDate: DateOnly): Bank {
  if (!isValidDateOnly(filingDate)) throw new RangeError(`Invalid filing date: ${filingDate}`);
  return compareDateOnly(filingDate, CUTOVER_DATE) < 0 ? "2008" : "2025";
}

export function resolveTestPath(input: PathInput): TestPath {
  const special = Boolean(input.specialConsideration);
  if (input.filingDate) {
    const bank = bankForFilingDate(input.filingDate);
    const rules = special ? RULES[bank].special : RULES[bank].standard;
    return {
      status: "determined",
      bank,
      special,
      rules,
      basis: "filing-date",
      explanation:
        bank === "2008"
          ? `Your N-400 filing date (${input.filingDate}) is before October 20, 2025, so the 2008 civics test applies: 100 questions, up to 10 asked, 6 correct to pass.`
          : `Your N-400 filing date (${input.filingDate}) is on or after October 20, 2025, so the 2025 civics test applies: 128 questions, up to 20 asked, 12 correct to pass.`,
    };
  }
  if (input.provisionalBank) {
    const bank = input.provisionalBank;
    const rules = special ? RULES[bank].special : RULES[bank].standard;
    return {
      status: "provisional",
      bank,
      special,
      rules,
      basis: "learner-choice",
      explanation: `You chose the ${bank} test while your filing date is unknown. Confirm your filing date to be sure: filed before October 20, 2025 means the 2008 test; on or after means the 2025 test.`,
    };
  }
  return {
    status: "unknown",
    bank: null,
    special,
    rules: null,
    basis: "none",
    explanation:
      "Your test version depends on the date your N-400 was filed, not your interview date. Filed before October 20, 2025: 2008 test (100 questions). Filed on or after: 2025 test (128 questions). Enter your filing date, or choose a test to study provisionally.",
  };
}

/** The 65/20 special consideration also applies to a chosen bank's designated 20 questions. */
export function describeSpecialConsideration(): string {
  return "If you are 65 or older and have been a lawful permanent resident for 20 or more years when you file, you may study only the 20 marked questions and will be asked 10 of them (6 correct to pass). USCIS decides whether this applies; OathSteps only changes what you practice.";
}
