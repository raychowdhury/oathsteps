# OathSteps: US Citizenship Prep

Mobile-first installable web app (PWA) that helps adults prepare for the U.S. naturalization interview: correct-bank civics recall practice, English tasks, a source-linked guide and a manual journey tracker. Tagline: *Practice. Prepare. Track your journey.*

## Commands

| Task | Command |
|---|---|
| Fresh setup | `pnpm bootstrap` (installs, creates `.env`, migrates SQLite, validates content, installs Chromium) |
| Develop | `pnpm dev` → http://localhost:3000 |
| Unit tests | `pnpm test` (Vitest; domain logic lives in `src/domain`) |
| Browser tests | `pnpm test:e2e` (Playwright, builds and serves the production build) |
| Content | `pnpm content:ingest` then `pnpm content:validate` (never edit `content/packs/*.json` by hand) |
| Database | `pnpm db:generate`, `pnpm db:migrate` (dev), `pnpm db:deploy` (prod) |
| Launch gates | `pnpm release:check` (nonzero while mail, operator details, legal review or content review are open) |
| Review packet | `pnpm content:review-packet` (PDF, spreadsheets and cover sheet for an expert reviewer) |
| Legal pages for GitHub Pages | `pnpm legal:site` (writes `site/`; `.github/workflows/pages.yml` publishes it) |
| Container smoke test | `bash scripts/docker-smoke.sh` (needs a Docker daemon; CI runs it) |
| Backup / restore (host) | `bash scripts/backup.sh`, `bash scripts/restore.sh <file>` (see docs/DEPLOY.md) |
| Everything | `pnpm verify` (writes `.harness/evidence/latest.json`, nonzero on any required failure); `pnpm verify:quick` skips build and e2e |
| iPhone app | `ios/build.sh` (XcodeGen + simulator build), `swift test --package-path ios/OathStepsCore`, `ios/test-ui.sh` (UI tests; account test needs `pnpm dev -p 3500`). On a Mac, `pnpm verify` runs both iOS checks |

## Architecture

- `content/` official sources (PDF + extracted text + hashes in `SOURCES.json`), ingestion/validation scripts, generated packs, guide stages (four stages, source keys), English tasks. Official wording is kept verbatim; everything else is labeled as an OathSteps addition.
- `src/domain/` pure, tested logic: date-only handling with injectable clock, test-path routing (`CUTOVER_DATE = 2025-10-20`), mock state machine (full rules + 5-question walkthrough), review scheduler, daily plan, readiness, answer matching, writing word diff, filing/interview/milestone validation, journey slots.
- `src/lib/` IndexedDB store (`store/`), content loader, guide loader, route wording (`path.ts`), Today snapshot/plan helpers (`today.ts`), speech synthesis + recognition (`speech.ts`), sync client, offline download, demo learner.
- `src/server/` Prisma client, Better Auth, mail transports (`mail.ts`), production config checks (`config.ts`, run at startup by `src/instrumentation.ts`), operator/legal details (`legal.ts`), release gates (`release.ts`), sync/account handlers, request guards, integration contracts.
- `deploy/` Cloudflare Tunnel and Caddy compose overlays. `docs/DEPLOY.md` is the runbook. `content/review/` holds the expert-review protocol and signed records.
- `src/components/` design-system shell: `Screen` (top bar, tabs, offline banner, sticky actions), `Overlay` (toasts, sheets, error line), `icons`, `ListenButton`, `FilingSheet`, `MilestoneSheet`, `Welcome`, `AppRoot` (tokens, theme, text size).
- `src/app/` screens: `/` (welcome or Today), `/privacy`, `/terms`, `/api/health`, `/account/reset`, `/setup`, `/readiness`, `/practice`, `/practice/session`, `/practice/mock`, `/interview` + `voice|reading|writing|instructions|n400|coach`, `/journey`, `/journey/guide`, `/settings`, `/account`, API routes.
- Styles: `src/app/globals.css` holds the design handoff's `.o-*` system verbatim (tokens on `.o-app`, container-query desktop layout, `.o-dark` theme). Use those classes; do not reintroduce Tailwind utility styling in screens.
- `public/sw.js` hand-written service worker: app shell + content after explicit download; never caches `/api`.
- `ios/` native SwiftUI app (see `ios/README.md`): `OathStepsCore` Swift package ports `src/domain` + `src/lib/today.ts` and the store/sync merge; the app bundles the same `content/` JSON files; accounts use the bearer token plugin. Keep both clients' rules in step: a domain change in `src/domain` needs the matching Swift change and test.
- `.harness/` feature ledger, progress, decisions, evidence. `scripts/verify.mjs` is the runner; `scripts/ledger.mjs` stamps features with evidence. `.claude/` holds project hooks.
- Design source: `oathsteps-handoff.zip` / the Claude Design canvas (see `.harness/decisions.md`, "design handoff").

## Scope and constraints

- Four destinations: Today, Practice, Interview, Journey (+ Settings). Guest study without an account; optional accounts with consented migration and idempotent sync.
- Filing date selects the bank: before 2025-10-20 → 2008 test (100 Q, up to 10 asked, 6 to pass); on/after → 2025 test (128 Q, up to 20 asked, 12 to pass, stop at 12 correct or 9 incorrect). 65/20 → designated 20, 10 asked, 6 to pass. Unknown stays unknown: Today and Practice say the version is not set and that practice uses the 2025 list until a filing date is added; the full-format mock needs a set version.
- Never: fabricate officeholder answers, show pass probabilities or readiness percentages, decide eligibility, collect SSN/A-number/USCIS password/identity documents/full N-400, promise background notifications, present unconfigured integrations as working.
- Hinted or multiple-choice recognition never counts as independent oral recall. Attempts record `method` and `prompted`.
- English is the only shipped language; no language selector until a reviewed translation exists.
- Content is machine-checked, not human-reviewed; the UI says so.

## Completion criteria

Every `track: core` feature in `.harness/features.json` is `verified` with evidence recorded for the current commit; `pnpm verify` passes; the production build boots from a fresh `pnpm bootstrap`; browser walkthrough evidence exists under `.harness/evidence/`.

## Resume procedure

1. Read `.harness/progress.md`, then `features.json` and `decisions.md`.
2. Run `pnpm verify:quick`.
3. Continue from the recorded next action. Update progress and evidence at each checkpoint; commit task-owned changes only.
4. To stop the Stop-hook reminders: set `state: complete` or `state: blocked` in `progress.md`, or `touch .harness/pause`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
