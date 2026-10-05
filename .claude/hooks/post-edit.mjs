#!/usr/bin/env node
// PostToolUse (Edit|Write): lightweight feedback only. Never blocks or reverts.
// - Typechecks a changed .ts/.tsx file's project quickly (tsc is too slow per edit, so we only run
//   eslint on the single file) and re-validates content when content files change.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

let input = "";
try {
  input = readFileSync(0, "utf8");
} catch {
  process.exit(0);
}
let data;
try {
  data = JSON.parse(input);
} catch {
  process.exit(0);
}
const file = data?.tool_input?.file_path ?? "";
const cwd = data?.cwd ?? process.cwd();
const notes = [];

if (/\/content\/(sources|scripts|packs|guide)\//.test(file)) {
  const r = spawnSync("pnpm", ["content:validate"], { cwd, encoding: "utf8", timeout: 60_000 });
  if (r.status !== 0) notes.push(`content:validate failed after editing ${file}:\n${(r.stdout + r.stderr).slice(-1500)}`);
}
if (/\.(ts|tsx|mjs)$/.test(file) && !/node_modules/.test(file)) {
  const r = spawnSync("pnpm", ["exec", "eslint", "--no-warn-ignored", file], { cwd, encoding: "utf8", timeout: 60_000 });
  if (r.status !== 0 && (r.stdout + r.stderr).trim()) notes.push(`eslint on ${file}:\n${(r.stdout + r.stderr).slice(-1500)}`);
}
if (notes.length) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: notes.join("\n\n") } }));
}
process.exit(0);
