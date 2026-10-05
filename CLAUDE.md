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
| Everything | `pnpm verify` (writes `.harness/evidence/latest.json`, nonzero on any required failure); `pnpm verify:quick` skips build and e2e |

## Architecture

- `content/` official sources (PDF + extracted text + hashes in `SOURCES.json`), ingestion/validation scripts, generated packs, guide stages. Official wording is kept verbatim; everything else is labeled as an OathSteps addition.
- `src/domain/` pure, tested logic: date-only handling with injectable clock, test-path routing (`CUTOVER_DATE = 2025-10-20`), mock state machine, review scheduler (documented interval ladder), daily plan, readiness indicators, answer variants. No UI, storage or provider imports.
- `src/lib/` client-side storage (IndexedDB via `idb`), content loading, audio, sync outbox, settings.
- `src/server/` Prisma client, Better Auth, sync/export/delete handlers. SQLite via `@prisma/adapter-better-sqlite3`.
- `src/app/` Next.js App Router: Today (`/`), Practice, Interview, Journey, Settings, auth pages, API routes.
- `public/sw.js` hand-written service worker: app shell + content packs after explicit download; never caches `/api/auth` or `/api/sync`.
- `.harness/` feature ledger, progress, decisions, evidence. `scripts/verify.mjs` is the runner. `.claude/` holds project hooks (post-edit lint/content check, bounded Stop ledger check).

## Scope and constraints

- Four destinations: Today, Practice, Interview, Journey (+ Settings). Guest study without an account; optional accounts with consented migration and idempotent sync.
- Filing date selects the bank: before 2025-10-20 → 2008 test (100 Q, up to 10 asked, 6 to pass); on/after → 2025 test (128 Q, up to 20 asked, 12 to pass, stop at 12 correct or 9 incorrect). 65/20 → designated 20, 10 asked, 6 to pass. Unknown stays unknown; a learner-chosen bank is labeled provisional.
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
