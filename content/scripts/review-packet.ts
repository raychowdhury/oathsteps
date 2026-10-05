/**
 * Build the packet a human reviewer works from: spreadsheets with the text to check plus a cover sheet that
 * names the exact content (by hash) a review record will cover. Output goes to content/review/out/ (not committed).
 * Run: pnpm content:review-packet
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { routeFor } from "../../src/lib/path";
import { handwrittenHash } from "./review";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "review", "out");
mkdirSync(OUT, { recursive: true });

const read = (p: string) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const csv = (rows: (string | number | null | undefined)[][]) => rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n") + "\r\n";
const write = (name: string, body: string) => writeFileSync(join(OUT, name), "﻿" + body); // BOM so Excel reads UTF-8

type Q = { id: string; number: number; section: string; subsection: string; prompt: string; answers: { text: string; note?: string }[]; requiredCount: number; special: boolean; dynamic?: { kind: string; scope: string; lookupUrl: string } };
const packs = [read("packs/civics-2025.json"), read("packs/civics-2008.json")];
for (const p of packs) {
  const rows: (string | number | null)[][] = [["Question ID", "No.", "Section", "Subsection", "Official question", "Accepted answers (official wording)", "Notes in the official list", "Correct answers needed", "65/20 set", "Answer depends on place or time", "Lookup the app shows", "Matches the official PDF? (Y/N)", "Comment"]];
  for (const q of p.questions as Q[]) rows.push([q.id, q.number, q.section, q.subsection, q.prompt, q.answers.map((a) => a.text).join(" | "), q.answers.map((a) => a.note ?? "").filter(Boolean).join(" | "), q.requiredCount, q.special ? "Y" : "", q.dynamic ? "Y" : "", q.dynamic?.lookupUrl ?? "", "", ""]);
  write(`questions-${p.bank}.csv`, csv(rows));
}

const guide = read("guide/stages.json");
const grows: (string | null)[][] = [["Stage", "Step ID", "Step", "Why it matters (OathSteps text)", "Official sources linked", "Accurate and clear? (Y/N)", "Comment"]];
for (const st of guide.stages) for (const it of st.items) grows.push([st.title, it.id, it.text, it.why, (it.links ?? []).map((k: string) => `${guide.sources[k].label} <${guide.sources[k].url}>`).join(" ; "), "", ""]);
write("guide.csv", csv(grows));

const english = read("english/tasks.json");
const erows: (string | null)[][] = [["Section", "ID", "Text", "Meaning or tip (OathSteps text)", "Appropriate and accurate? (Y/N)", "Comment"]];
for (const x of english.reading) erows.push(["Reading sentence", x.id, x.text, "", "", ""]);
for (const x of english.writing) erows.push(["Writing sentence", x.id, x.text, "", "", ""]);
for (const x of english.instructions) erows.push(["Officer instruction", x.id, x.text, x.meaning, "", ""]);
for (const x of english.vocabulary) erows.push(["Vocabulary", x.id, x.term, x.meaning, "", ""]);
for (const x of english.conversation) erows.push(["Conversation prompt", x.id, x.prompt, x.tip, "", ""]);
write("english-and-interview.csv", csv(erows));

const routes = [
  { label: "Filed before Oct 20, 2025", r: routeFor({ filingDate: "2025-10-19", filingDateUnknown: false, specialConsideration: false }) },
  { label: "Filed on or after Oct 20, 2025", r: routeFor({ filingDate: "2025-10-20", filingDateUnknown: false, specialConsideration: false }) },
  { label: "Filed on or after Oct 20, 2025, 65/20 chosen", r: routeFor({ filingDate: "2025-10-20", filingDateUnknown: false, specialConsideration: true }) },
  { label: "Filing date unknown", r: routeFor({ filingDate: null, filingDateUnknown: true, specialConsideration: false }) },
];
const statements = routes.map(({ label, r }) => `- **${label}:** ${[`${r.name}.`, ...r.lines.map((l) => `${l}.`), r.reason].filter((x) => x && x !== ".").join(" ")}`).join("\n");

const refs = [
  ["civics-2025", packs[0].contentHash, `2025 civics test pack ${packs[0].version}`, "questions-2025.csv"],
  ["civics-2008", packs[1].contentHash, `2008 civics test pack ${packs[1].version}`, "questions-2008.csv"],
  ["guide", handwrittenHash(guide), `Preparation guide ${guide.version}`, "guide.csv"],
  ["english", handwrittenHash(english), `Interview English practice ${english.version}`, "english-and-interview.csv"],
];

writeFileSync(
  join(OUT, "REVIEW-PACKET.md"),
  `# OathSteps content review packet

Generated ${new Date().toISOString().slice(0, 10)}. OathSteps is a private study tool for the U.S. naturalization civics test and interview. It is not affiliated with USCIS and gives no legal advice. It has not been reviewed by an expert yet. This packet asks you to do that.

## What you are reviewing

| Scope | File | Content reference (sha256) |
|---|---|---|
${refs.map(([s, h, t, f]) => `| ${s}: ${t} | ${f} | \`${h}\` |`).join("\n")}

The content reference names the exact text you saw. If the text changes later, your approval no longer applies to it and a new review is needed.

## How much work this is

The 228 civics questions and answers are copied word for word from two official USCIS PDFs, and a program checks the counts, numbering and file hashes. You do not need to rewrite them. Please spot check that the answers in the spreadsheet match the PDF, especially questions with several accepted answers, notes in brackets, and questions whose answers depend on where the learner lives or who holds an office. The two PDFs are in \`content/sources/\`.

The text OathSteps wrote itself is where your judgment matters most: the preparation guide, the interview English material, the routing statements below, and the screen disclaimers.

## What to check

1. Questions: is each question and each accepted answer identical to the official PDF? Are the "answer depends on place or time" flags right?
2. Guide: is each step accurate, current and clear for an adult learner? Does any step sound like legal advice, promise an outcome, or tell someone what to answer? Are the linked sources the right official pages?
3. English material: are the sentences, officer instructions, meanings and conversation prompts appropriate for adult learners and true to how interviews go? Do any prompts push a learner toward a particular answer about their own case?
4. Routing statements the app makes (below): are they correct?
5. Disclaimers: are they enough?
   - "OathSteps is a private study tool, not a government service and not legal advice."
   - "Not affiliated with USCIS."
   - "We never ask for your SSN, A-Number, ID or USCIS password."
   - "Machine-checked, not yet expert-reviewed." (replaced by your review status after sign-off)

### Routing statements in the app

${statements}

Rules the app applies: the 2025 test asks up to 20 questions, 12 correct to pass, stops at 12 correct or 9 incorrect. The 2008 test asks up to 10, 6 correct to pass, stops at 6 correct or 5 incorrect. The 65/20 format uses 20 designated questions, up to 10 asked, 6 to pass. The learner enters the filing date and chooses the 65/20 format. The app does not decide eligibility.

## How to return your review

1. Mark the "Matches" or "Accurate" column Y or N and add comments to the spreadsheets, or send your comments any way you prefer.
2. Tell the owner whether you approve each scope as it stands, or what must change. Changes are made, a new packet is generated, and you approve the new reference.
3. For each scope you approve, the owner records: your name, your credential (for example "Licensed attorney, New York" or "DOJ-accredited representative"), the date, and the content reference above. Only your credential and date appear in the app. Your name stays in the project's records and is shown only with your consent.
`,
);
console.log(`Review packet written to ${OUT}`);
for (const [s, h] of refs) console.log(`${s}\t${h}`);
