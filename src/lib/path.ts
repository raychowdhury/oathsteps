import { CUTOVER_DATE, RULES } from "@/domain/testPath";
import type { Bank, StudyProfile } from "@/domain/types";
import { questionsFor, type Question } from "./content";

/** The learner's study path in the design's words. */
export interface Route {
  key: Bank | "none";
  /** Full name, e.g. "2025 civics test, 65/20 format". */
  name: string;
  /** Tag text, e.g. "2025 civics test · 65/20" or "Test version not set". */
  short: string;
  lines: string[];
  reason: string;
  bank: number | null;
  asked: number | null;
  mock: string;
  /** Source key in the guide's sources map. */
  src: "q100" | "q128";
  special: boolean;
}

const V = {
  "2008": { name: "2008 civics test", bank: 100, asked: 10, pass: 6, src: "q100" as const, lines: ["100 questions to study", "Up to 10 asked · 6 correct to pass"], reason: "Filed before Oct 20, 2025.", mock: "Up to 10 asked · 6 correct to pass." },
  "2025": { name: "2025 civics test", bank: 128, asked: 20, pass: 12, src: "q128" as const, lines: ["128 questions to study", "Up to 20 asked · 12 correct to pass", "Stops at 12 correct or 9 incorrect"], reason: "Filed on or after Oct 20, 2025.", mock: "Up to 20 asked · 12 correct to pass." },
};
const S6520 = { lines: ["20 designated questions to study", "10 asked · 6 correct to pass"], mock: "10 of 20 asked · 6 correct to pass." };

export function routeFor(p: { filingDate: string | null; filingDateUnknown: boolean; specialConsideration: boolean }): Route {
  if (p.filingDateUnknown || !p.filingDate) {
    return { key: "none", name: "Test version not chosen", short: "Test version not set", lines: [], reason: "", bank: null, asked: null, mock: "Add your filing date to see your format.", src: "q128", special: p.specialConsideration };
  }
  const key: Bank = p.filingDate >= CUTOVER_DATE ? "2025" : "2008";
  const v = V[key];
  const r: Route = { key, name: v.name, short: v.name, lines: [...v.lines], reason: v.reason, bank: v.bank, asked: v.asked, mock: v.mock, src: v.src, special: false };
  if (p.specialConsideration) {
    r.short = `${v.name} · 65/20`;
    r.name = `${v.name}, 65/20 format`;
    r.lines = [...S6520.lines];
    r.bank = RULES[key].specialSize;
    r.asked = RULES[key].special.asked;
    r.mock = S6520.mock;
    r.reason += " You chose the 65/20 format.";
    r.special = true;
  }
  return r;
}

export function routeForProfile(p: StudyProfile): Route {
  return routeFor({ filingDate: p.filingDate, filingDateUnknown: p.filingDateUnknown, specialConsideration: p.specialConsideration });
}

/**
 * Bank used for practice. Unknown version practices the 2025 list, labeled as such on screen,
 * until the learner adds a filing date. This is a visible choice, never a silent default.
 */
export function practiceBank(route: Route): Bank {
  return route.key === "none" ? "2025" : route.key;
}

export function practiceQuestions(route: Route): Question[] {
  return questionsFor(practiceBank(route), route.special);
}
