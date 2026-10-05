#!/usr/bin/env node
/**
 * Stamp feature ledger entries with evidence from the latest verification run.
 *
 *   node scripts/ledger.mjs verify F-001 F-002 --checks content,unit,e2e --note "..."
 *   node scripts/ledger.mjs status F-015 blocked --note "..."
 *   node scripts/ledger.mjs report
 *
 * `verify` refuses when latest.json is missing, failed, or was recorded for a different commit
 * than HEAD, so a feature can never be marked verified against stale evidence.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const ledgerPath = join(root, ".harness", "features.json");
const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
const [cmd, ...rest] = process.argv.slice(2);
const flag = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const ids = rest.filter((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1].startsWith("--")));

if (cmd === "report") {
  for (const f of ledger.features) console.log(`${f.id.padEnd(6)} ${f.track.padEnd(12)} ${f.status.padEnd(12)} ${f.title}`);
  const core = ledger.features.filter((f) => f.track === "core");
  console.log(`\ncore verified: ${core.filter((f) => f.status === "verified").length}/${core.length}`);
  process.exit(0);
}

if (cmd === "status") {
  const [id, status] = ids;
  const f = ledger.features.find((x) => x.id === id);
  if (!f || !["planned", "in-progress", "verified", "blocked"].includes(status)) throw new Error("usage: status <id> <planned|in-progress|verified|blocked>");
  f.status = status;
  if (flag("note")) f.note = flag("note");
  save();
  process.exit(0);
}

if (cmd === "verify") {
  const evidence = JSON.parse(readFileSync(join(root, ".harness", "evidence", "latest.json"), "utf8"));
  const head = execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim();
  if (!evidence.ok) throw new Error("latest.json records a failed run; fix it before stamping features");
  if (evidence.commit !== head) throw new Error(`latest.json is for ${evidence.commit?.slice(0, 7)} but HEAD is ${head.slice(0, 7)}; rerun pnpm verify`);
  if (evidence.workingTreeDirty) console.warn("⚠ evidence was recorded with a dirty working tree");
  const checks = (flag("checks") ?? "content,typecheck,lint,unit,build,e2e").split(",");
  for (const c of checks) {
    const r = evidence.results.find((x) => x.id === c);
    if (!r || r.status !== "passed") throw new Error(`check "${c}" did not pass in latest.json`);
  }
  for (const id of ids) {
    const f = ledger.features.find((x) => x.id === id);
    if (!f) throw new Error(`unknown feature ${id}`);
    f.status = "verified";
    f.evidence = [{ commit: head, recordedAt: evidence.recordedAt, checks, note: flag("note") ?? null }];
  }
  save();
  console.log(`stamped ${ids.length} feature(s) at ${head.slice(0, 7)}`);
  process.exit(0);
}

console.error("usage: ledger.mjs report | status <id> <status> | verify <ids...> --checks a,b --note '...'");
process.exit(1);

function save() {
  ledger.updatedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");
}
