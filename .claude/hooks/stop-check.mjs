#!/usr/bin/env node
// Stop hook: bounded completion check against the feature ledger and latest evidence.
// - Exits 0 immediately when stop_hook_active is true (never loops).
// - Exits 0 when .harness/pause exists (explicit user stop) or progress.md says "state: complete" or "state: blocked".
// - Otherwise reports unverified core features once as non-error feedback so the loop can continue.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

let data = {};
try {
  data = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
if (data.stop_hook_active) process.exit(0);
const cwd = data.cwd ?? process.cwd();
if (existsSync(join(cwd, ".harness", "pause"))) process.exit(0);

const progressPath = join(cwd, ".harness", "progress.md");
const ledgerPath = join(cwd, ".harness", "features.json");
if (!existsSync(progressPath) || !existsSync(ledgerPath)) process.exit(0);

const progress = readFileSync(progressPath, "utf8");
const state = (progress.match(/^state:\s*(\S+)/m) ?? [])[1] ?? "unknown";
if (state === "complete" || state === "blocked" || state === "handoff") process.exit(0);

const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
const core = ledger.features.filter((f) => f.track === "core");
const unverified = core.filter((f) => f.status !== "verified");
if (!unverified.length) process.exit(0);

const next = (progress.match(/^next action:\s*(.+)$/m) ?? [])[1] ?? "(none recorded)";
const msg = `Harness check: ${unverified.length}/${core.length} core features not yet verified (${unverified.slice(0, 8).map((f) => `${f.id}:${f.status}`).join(", ")}${unverified.length > 8 ? ", …" : ""}). Recorded next action: ${next}. Continue the loop, or set "state: blocked"/"state: complete" in .harness/progress.md (or touch .harness/pause) to stop.`;
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "Stop", additionalContext: msg } }));
process.exit(0);
