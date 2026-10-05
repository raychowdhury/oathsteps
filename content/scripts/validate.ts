/**
 * Validate the generated content packs against the official sources.
 * Exit code 1 on any failure. Run: pnpm content:validate
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const sources = JSON.parse(readFileSync(join(ROOT, "sources", "SOURCES.json"), "utf8"));
const failures: string[] = [];
const fail = (m: string) => failures.push(m);

const expectations = {
  "civics-2025": { count: 128, special: 20, dynamic: 8, asked: 20, pass: 12, stopIncorrect: 9 },
  "civics-2008": { count: 100, special: 20, dynamic: 10, asked: 10, pass: 6, stopIncorrect: 5 },
} as const;

const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");

for (const doc of sources.documents) {
  const p = join(ROOT, "sources", doc.file);
  if (!existsSync(p)) fail(`${doc.id}: source file ${doc.file} missing`);
  else if (sha(p) !== doc.sha256) fail(`${doc.id}: sha256 of ${doc.file} does not match SOURCES.json`);
  if (doc.textFile) {
    const t = join(ROOT, "sources", doc.textFile);
    if (!existsSync(t)) fail(`${doc.id}: text file missing`);
    else if (sha(t) !== doc.textSha256) fail(`${doc.id}: sha256 of ${doc.textFile} does not match SOURCES.json`);
  }
}

for (const [packId, exp] of Object.entries(expectations)) {
  const path = join(ROOT, "packs", `${packId}.json`);
  if (!existsSync(path)) {
    fail(`${packId}: pack missing (run pnpm content:ingest)`);
    continue;
  }
  const pack = JSON.parse(readFileSync(path, "utf8"));
  const { contentHash, version, generatedAt, ...body } = pack;
  void version;
  void generatedAt;
  if (createHash("sha256").update(JSON.stringify(body)).digest("hex") !== contentHash) fail(`${packId}: contentHash mismatch (pack edited after generation)`);
  const qs = pack.questions as Array<{ id: string; number: number; prompt: string; answers: { text: string }[]; requiredCount: number; special: boolean; dynamic?: unknown; section: string; subsection: string }>;
  if (qs.length !== exp.count) fail(`${packId}: ${qs.length} questions, expected ${exp.count}`);
  if (qs.filter((q) => q.special).length !== exp.special) fail(`${packId}: special-consideration count != ${exp.special}`);
  if (qs.filter((q) => q.dynamic).length !== exp.dynamic) fail(`${packId}: dynamic count != ${exp.dynamic}`);
  if (pack.rules.standard.asked !== exp.asked || pack.rules.standard.pass !== exp.pass || pack.rules.standard.stopIncorrect !== exp.stopIncorrect) fail(`${packId}: standard rules differ from expected`);
  const ids = new Set<string>();
  qs.forEach((q, i) => {
    if (ids.has(q.id)) fail(`${packId}: duplicate id ${q.id}`);
    ids.add(q.id);
    if (q.number !== i + 1) fail(`${packId}: numbering gap at ${q.id}`);
    if (!q.prompt || !/[?.]$/.test(q.prompt)) fail(`${q.id}: prompt looks truncated: "${q.prompt}"`);
    if (!q.answers.length) fail(`${q.id}: no answers`);
    if (q.answers.some((a) => !a.text)) fail(`${q.id}: empty answer text`);
    if (q.requiredCount > q.answers.length && !q.dynamic) fail(`${q.id}: requiredCount ${q.requiredCount} > answers ${q.answers.length}`);
    if (!q.section || !q.subsection) fail(`${q.id}: missing section labels`);
    if (!q.dynamic && q.answers.some((a) => /answers will vary|testupdates/i.test(a.text))) fail(`${q.id}: varying answer without dynamic rule`);
  });
  const doc = sources.documents.find((d: { id: string }) => d.id === pack.source.id);
  if (!doc || doc.sha256 !== pack.source.sha256) fail(`${packId}: pack source hash does not match SOURCES.json`);
  if (pack.review?.humanReviewed === true) fail(`${packId}: humanReviewed is true but no reviewer record exists in this repo`);
}

const guidePath = join(ROOT, "guide", "stages.json");
if (!existsSync(guidePath)) fail("guide/stages.json missing");
else {
  const guide = JSON.parse(readFileSync(guidePath, "utf8"));
  const official = /^https:\/\/(www\.)?(uscis\.gov|usa\.gov|ecfr\.gov|federalregister\.gov|travel\.state\.gov|ssa\.gov|house\.gov|senate\.gov|vote\.gov)/;
  for (const [k, s] of Object.entries(guide.sources as Record<string, { label: string; url: string }>)) if (!official.test(s.url)) fail(`guide source ${k}: non-official url ${s.url}`);
  const ids = new Set<string>();
  for (const stage of guide.stages) {
    if (!stage.id || !stage.title) fail(`guide stage missing id/title`);
    for (const item of stage.items) {
      if (!item.id || !item.text || !item.why) fail(`guide ${stage.id}: item missing id/text/why`);
      if (ids.has(item.id)) fail(`guide: duplicate item id ${item.id}`);
      ids.add(item.id);
      for (const l of item.links ?? []) if (!guide.sources[l]) fail(`guide ${item.id}: unknown source key ${l}`);
      if (item.action && !["filing", "settings", "journey"].includes(item.action)) fail(`guide ${item.id}: unknown action ${item.action}`);
    }
  }
  if (guide.review?.humanReviewed === true) fail("guide: humanReviewed true without reviewer record");
}

const result = { ok: failures.length === 0, checkedAt: new Date().toISOString(), failures };
console.log(JSON.stringify(result, null, 2));
process.exit(failures.length ? 1 : 0);
