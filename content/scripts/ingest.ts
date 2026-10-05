/**
 * Ingest the official USCIS civics question banks into versioned content packs.
 *
 * Input:  content/sources/2025-128q.txt and 2008-100q.txt (pypdf extractions of
 *         the official PDFs; hashes in content/sources/SOURCES.json).
 * Output: content/packs/civics-2025.json and civics-2008.json.
 *
 * Only the official wording is carried over. Original explanations, dynamic
 * answer lookups and required-answer counts are added here and marked as such.
 * Run: pnpm content:ingest
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DYNAMIC_ANSWERS, REQUIRED_COUNT_OVERRIDES } from "./ingest-rules";

const ROOT = join(import.meta.dirname, "..");
const sources = JSON.parse(readFileSync(join(ROOT, "sources", "SOURCES.json"), "utf8"));

export type Answer = { text: string; note?: string };
export type Question = {
  id: string;
  number: number;
  bank: "2008" | "2025";
  section: string;
  subsection: string;
  prompt: string;
  answers: Answer[];
  requiredCount: number;
  special: boolean;
  /** Official bracketed note attached to the question itself. */
  note?: string;
  dynamic?: { kind: string; lookupUrl: string; lookupLabel: string; scope: "federal" | "state" | "district" };
};

type Bank = {
  bank: "2008" | "2025";
  sourceId: string;
  textFile: string;
  expectedCount: number;
  rules: {
    standard: { asked: number; pass: number; stopIncorrect: number };
    special: { asked: number; pass: number; stopIncorrect: number };
  };
  appliesWhen: string;
};

const BANKS: Bank[] = [
  {
    bank: "2025",
    sourceId: "uscis-2025-128q",
    textFile: "2025-128q.txt",
    expectedCount: 128,
    rules: { standard: { asked: 20, pass: 12, stopIncorrect: 9 }, special: { asked: 10, pass: 6, stopIncorrect: 5 } },
    appliesWhen: "Form N-400 filed on or after 2025-10-20",
  },
  {
    bank: "2008",
    sourceId: "uscis-2008-100q",
    textFile: "2008-100q.txt",
    expectedCount: 100,
    rules: { standard: { asked: 10, pass: 6, stopIncorrect: 5 }, special: { asked: 10, pass: 6, stopIncorrect: 5 } },
    appliesWhen: "Form N-400 filed before 2025-10-20",
  },
];

const NOISE = [
  /^=== PAGE \d+ ===$/,
  /^\d+ of \d+$/,
  /^-\d+-$/,
  /^uscis\.gov\/citizenship$/,
  /^www\.uscis\.gov$/,
  /^M-1778 \(09\/25\)$/,
  /^\(rev\. 01\/19\)$/,
  /^\*\s+If you are 65 years old or older/,
  /^may study just the questions that have been marked with an asterisk\.$/,
];
const TOP_SECTIONS = ["AMERICAN GOVERNMENT", "AMERICAN HISTORY", "INTEGRATED CIVICS", "SYMBOLS AND HOLIDAYS"];

function clean(line: string) {
  return line.replace(/\t/g, " ").replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function requiredCount(prompt: string): number {
  const p = prompt.toLowerCase();
  const words: Record<string, number> = { one: 1, two: 2, three: 3 };
  const m = p.match(/\b(?:name|list|give|describe)\s+(one|two|three)\b/) ?? p.match(/\bwhat (?:are|were) (two|three)\b/);
  return m ? words[m[1]] : 1;
}

function parse(bank: Bank): Question[] {
  const raw = readFileSync(join(ROOT, "sources", bank.textFile), "utf8").split("\n");
  const questions: Question[] = [];
  let section = "";
  let subsection = "";
  let started = false;
  let current: Question | null = null;

  for (const rawLine of raw) {
    const line = clean(rawLine);
    if (!line || NOISE.some((re) => re.test(line))) continue;
    if (TOP_SECTIONS.includes(line)) {
      section = line;
      started = true;
      continue;
    }
    if (!started) continue;
    const sub = line.match(/^([A-C]): (.+)$/);
    if (sub) {
      subsection = sub[2];
      continue;
    }
    const q = line.match(/^(\d{1,3})\.\s*(.+)$/);
    if (q) {
      let prompt = q[2].trim();
      const special = /\*\s*$/.test(prompt);
      prompt = prompt.replace(/\s*\*\s*$/, "").replace(/\s+\?$/, "?").trim();
      const number = Number(q[1]);
      current = {
        id: `${bank.bank}-${String(number).padStart(3, "0")}`,
        number,
        bank: bank.bank,
        section,
        subsection,
        prompt,
        answers: [],
        requiredCount: 1,
        special,
      };
      questions.push(current);
      continue;
    }
    if (!current) continue;
    const a = line.match(/^[•▪]\s*(.+)$/);
    if (a) {
      current.answers.push(splitNote(a[1]));
      continue;
    }
    // Continuation of the previous answer (long bracketed notes wrap) or of the prompt.
    if (current.answers.length) {
      const last = current.answers[current.answers.length - 1];
      const merged = splitNote(`${last.text}${last.note ? ` [${last.note}` : ""} ${line}`.replace(/\]\s*\[/, " "));
      current.answers[current.answers.length - 1] = merged;
    } else if (line.startsWith("[")) {
      current.note = clean(`${current.note ?? ""} ${line}`).replace(/^\[|\]$/g, "").trim();
    } else {
      current.prompt = clean(`${current.prompt} ${line}`);
    }
  }

  for (const q of questions) {
    q.requiredCount = REQUIRED_COUNT_OVERRIDES[q.id] ?? requiredCount(q.prompt);
    const dyn = DYNAMIC_ANSWERS[q.id];
    if (dyn) q.dynamic = dyn;
    const varies = q.answers.some((x) => /answers will vary|testupdates/i.test(x.text + (x.note ?? "")));
    if (varies && !dyn) throw new Error(`${q.id} has a varying answer but no dynamic rule: ${q.prompt}`);
  }
  return questions;
}

function splitNote(text: string): Answer {
  const m = text.match(/^(.*?)\s*\[(.+)\]\s*$/);
  if (m) return { text: m[1].trim(), note: m[2].trim() };
  return { text: text.trim() };
}

for (const bank of BANKS) {
  const doc = sources.documents.find((d: { id: string }) => d.id === bank.sourceId);
  const questions = parse(bank);
  if (questions.length !== bank.expectedCount) {
    throw new Error(`${bank.bank}: parsed ${questions.length}, expected ${bank.expectedCount}`);
  }
  const body = {
    packId: `civics-${bank.bank}`,
    bank: bank.bank,
    title: bank.bank === "2025" ? "2025 civics test (128 questions)" : "2008 civics test (100 questions)",
    appliesWhen: bank.appliesWhen,
    rules: bank.rules,
    source: { id: doc.id, title: doc.title, url: doc.url, sha256: doc.sha256, retrievedAt: sources.retrievedAt },
    review: {
      machineChecked: true,
      humanReviewed: false,
      note: "Wording and answers were machine-extracted from the official PDF and validated for counts and structure. No qualified human or legal review has been performed yet.",
    },
    questions,
  };
  const contentHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const pack = { ...body, version: `${bank.bank}.${contentHash.slice(0, 8)}`, contentHash, generatedAt: new Date().toISOString() };
  writeFileSync(join(ROOT, "packs", `civics-${bank.bank}.json`), JSON.stringify(pack, null, 2) + "\n");
  console.log(`${pack.packId}: ${questions.length} questions, ${questions.filter((q) => q.special).length} special, ${questions.filter((q) => q.dynamic).length} dynamic, version ${pack.version}`);
}
