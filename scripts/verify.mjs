#!/usr/bin/env node
/**
 * Consolidated verification runner.
 * Runs each check, records command, exit code, duration and tail of output in
 * .harness/evidence/latest.json (and a dated copy), exits nonzero if any
 * required check fails. Skipped/blocked checks are recorded as such, never as passed.
 *
 *   pnpm verify            # everything required
 *   pnpm verify --quick    # validate + typecheck + lint + unit
 *   pnpm verify --only e2e # a single check by id
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const args = process.argv.slice(2);
const quick = args.includes("--quick");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

const onMac = process.platform === "darwin";
const checks = [
  { id: "content", cmd: "pnpm", argv: ["content:validate"], required: true, quick: true },
  { id: "typecheck", cmd: "pnpm", argv: ["typecheck"], required: true, quick: true },
  { id: "lint", cmd: "pnpm", argv: ["lint"], required: true, quick: true },
  { id: "unit", cmd: "pnpm", argv: ["test", "--", "--run"], required: true, quick: true },
  { id: "build", cmd: "pnpm", argv: ["build"], required: true, quick: false },
  { id: "e2e", cmd: "pnpm", argv: ["test:e2e"], required: true, quick: false, skipIf: () => (existsSync(join(root, "node_modules/.bin/playwright")) ? null : "playwright not installed") },
  // The iPhone app needs macOS with Xcode. Required there; recorded as skipped elsewhere (Linux CI runs them in ios.yml).
  { id: "ios-core", cmd: "swift", argv: ["test", "--package-path", "ios/OathStepsCore"], required: onMac, quick: true, skipIf: () => (onMac ? null : "needs macOS with Xcode") },
  { id: "ios-ui", cmd: "bash", argv: ["ios/test-ui.sh"], required: onMac, quick: false, skipIf: () => (!onMac ? "needs macOS with Xcode" : spawnSync("which", ["xcodegen"]).status === 0 ? null : "xcodegen not installed (brew install xcodegen)") },
];

const results = [];
let failed = false;
for (const c of checks) {
  if (only && c.id !== only) continue;
  if (quick && !c.quick) {
    results.push({ id: c.id, status: "skipped", reason: "--quick" });
    continue;
  }
  const skip = c.skipIf?.();
  if (skip) {
    results.push({ id: c.id, status: "skipped", reason: skip, required: c.required });
    if (c.required) failed = true;
    continue;
  }
  const started = Date.now();
  process.stdout.write(`\n▶ ${c.id}: ${c.cmd} ${c.argv.join(" ")}\n`);
  const r = spawnSync(c.cmd, c.argv, { cwd: root, encoding: "utf8", env: { ...process.env, CI: process.env.CI ?? "1" }, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  process.stdout.write(out.slice(-4000));
  const status = r.status === 0 ? "passed" : "failed";
  if (status === "failed" && c.required) failed = true;
  results.push({ id: c.id, status, required: c.required, exitCode: r.status, durationMs: Date.now() - started, command: `${c.cmd} ${c.argv.join(" ")}`, outputTail: out.slice(-3000) });
}

const git = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout?.trim() ?? null;
const dirty = (spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).stdout ?? "").trim().length > 0;
const evidence = { recordedAt: new Date().toISOString(), commit: git, workingTreeDirty: dirty, node: process.version, mode: only ? `only:${only}` : quick ? "quick" : "full", ok: !failed, results };
const dir = join(root, ".harness", "evidence");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "latest.json"), JSON.stringify(evidence, null, 2) + "\n");
writeFileSync(join(dir, `${evidence.recordedAt.replace(/[:.]/g, "-")}.json`), JSON.stringify(evidence, null, 2) + "\n");

// Keep features.json honest: anything verified must point at evidence recorded for the current commit.
const ledgerPath = join(root, ".harness", "features.json");
if (existsSync(ledgerPath)) {
  const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
  const stale = ledger.features.filter((f) => f.status === "verified" && !f.evidence?.some((e) => e.commit === git));
  if (stale.length) console.log(`\n⚠ ${stale.length} feature(s) marked verified without evidence for commit ${git?.slice(0, 7)}: ${stale.map((f) => f.id).join(", ")}`);
}

console.log(`\n${failed ? "✖ verification failed" : "✔ verification passed"} (${evidence.mode}) → .harness/evidence/latest.json`);
process.exit(failed ? 1 : 0);
