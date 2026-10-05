/**
 * Hand-reviewed ingestion rules. These are OathSteps additions, not official text.
 *
 * DYNAMIC_ANSWERS: questions whose official answer is "Answers will vary" or
 * changes with elections/appointments. The app never generates these answers;
 * it sends the learner to an official lookup and lets them record a confirmed
 * answer with a date.
 */
const USCIS_UPDATES = "https://www.uscis.gov/citizenship/testupdates";

type Dyn = { kind: string; lookupUrl: string; lookupLabel: string; scope: "federal" | "state" | "district" };

const senator: Dyn = { kind: "senator", lookupUrl: "https://www.senate.gov/senators/senators-contact.htm", lookupLabel: "Find your state's senators on senate.gov", scope: "state" };
const representative: Dyn = { kind: "representative", lookupUrl: "https://www.house.gov/representatives/find-your-representative", lookupLabel: "Find your representative on house.gov (a ZIP code can span districts; confirm your address)", scope: "district" };
const speaker: Dyn = { kind: "speaker", lookupUrl: "https://www.house.gov/leadership", lookupLabel: "Check House leadership on house.gov", scope: "federal" };
const president: Dyn = { kind: "president", lookupUrl: USCIS_UPDATES, lookupLabel: "Check USCIS test updates for the current President", scope: "federal" };
const vicePresident: Dyn = { kind: "vice-president", lookupUrl: USCIS_UPDATES, lookupLabel: "Check USCIS test updates for the current Vice President", scope: "federal" };
const chiefJustice: Dyn = { kind: "chief-justice", lookupUrl: "https://www.supremecourt.gov/about/biographies.aspx", lookupLabel: "Check the Supreme Court's justice biographies", scope: "federal" };
const governor: Dyn = { kind: "governor", lookupUrl: "https://www.usa.gov/state-governor", lookupLabel: "Find your governor on usa.gov", scope: "state" };
const stateCapital: Dyn = { kind: "state-capital", lookupUrl: "https://www.usa.gov/state-governments", lookupLabel: "Find your state government site on usa.gov", scope: "state" };
const justiceCount: Dyn = { kind: "justice-count", lookupUrl: USCIS_UPDATES, lookupLabel: "Check USCIS test updates for the current number of justices", scope: "federal" };
const presidentParty: Dyn = { kind: "president-party", lookupUrl: USCIS_UPDATES, lookupLabel: "Check USCIS test updates for the current President's party", scope: "federal" };

export const DYNAMIC_ANSWERS: Record<string, Dyn> = {
  "2025-023": senator,
  "2025-029": representative,
  "2025-030": speaker,
  "2025-038": president,
  "2025-039": vicePresident,
  "2025-057": chiefJustice,
  "2025-061": governor,
  "2025-062": stateCapital,
  "2008-020": senator,
  "2008-023": representative,
  "2008-028": president,
  "2008-029": vicePresident,
  "2008-039": justiceCount,
  "2008-040": chiefJustice,
  "2008-043": governor,
  "2008-044": stateCapital,
  "2008-046": presidentParty,
  "2008-047": speaker,
};

/**
 * Required number of distinct answers. The parser infers this from "Name two",
 * "What are three ..." wording; list exceptions here after review.
 * Reviewed 2026-10-05: parser output matched the official prompts, no overrides needed.
 */
export const REQUIRED_COUNT_OVERRIDES: Record<string, number> = {};
