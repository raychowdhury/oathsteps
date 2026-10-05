/**
 * Lists what still blocks a public launch. Reads the deployment's environment (.env) and the content review state.
 * Exit code 1 while anything is blocked. Run on the server or with the production env loaded:  pnpm release:check
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { releaseChecks } from "../src/server/release";

try {
  process.loadEnvFile(join(import.meta.dirname, "..", ".env"));
} catch {
  /* no .env: use the process environment */
}
const read = (p: string) => JSON.parse(readFileSync(join(import.meta.dirname, "..", p), "utf8"));
const packs = ["civics-2025", "civics-2008"].map((id) => ({ id, humanReviewed: read(`content/packs/${id}.json`).review.humanReviewed === true }));
const checks = releaseChecks(process.env, { packs, guide: read("content/guide/stages.json").review.humanReviewed === true, english: read("content/english/tasks.json").review.humanReviewed === true });

for (const c of checks) console.log(`${c.status === "ok" ? "  ok     " : "  BLOCKED"}  ${c.id.padEnd(22)} ${c.detail}`);
const blocked = checks.filter((c) => c.status === "blocked").length;
console.log(`\n${blocked ? `${blocked} blocked. Not ready for a public launch.` : "All machine-checkable gates are closed."}`);
console.log("Not machine-checkable: DNS for your mail domain (SPF/DKIM), backups scheduled, uptime monitor on /api/health. See docs/DEPLOY.md.");
process.exit(blocked ? 1 : 0);
