# OathSteps: US Citizenship Prep

*Practice. Prepare. Track your journey.*

A mobile-first, installable web app (PWA) for adults preparing for the U.S. naturalization interview. It answers three questions every day: what should I practice, what do I still need to improve, and what should I prepare next.

- **Correct civics bank for your filing date.** N-400 filed before 20 October 2025 → 2008 test (100 questions, up to 10 asked, 6 to pass). Filed on or after → 2025 test (128 questions, up to 20 asked, 12 to pass, stop at 12 correct or 9 incorrect). 65/20 special consideration uses the 20 designated questions. Unknown dates stay unknown.
- **Recall first.** Cards ask before they tell. Hinted and multiple-choice recognition are recorded separately from independent oral recall. A documented review ladder schedules weak answers sooner.
- **Mock tests** with the real stopping rules, pause/resume, and honest results (what was attempted, self-assessed).
- **Interview English**: reading, dictation, officer instructions, N-400 vocabulary and truthful conversation practice. Never invents personal answers.
- **Readiness** indicators computed from stored events with their definitions. No scores, no pass probability.
- **Journey**: user-entered milestones (filed, receipt, biometrics attended or reused, interview, continuation, retest, evidence request, decision, oath), a stage-by-stage guide with official links, checklists, in-app reminders and `.ics` export.
- **Guest first.** Everything works without an account in IndexedDB. Optional accounts (email + password) add consented migration and idempotent sync.
- **Offline**: explicit download caches the app and all questions; browser speech synthesis reads questions aloud when a voice is available.

OathSteps is a private educational tool. It is not affiliated with USCIS, does not decide eligibility, does not predict outcomes and is not legal advice. Content is machine-checked against the official USCIS PDFs and not yet reviewed by a qualified person; the app says so.

## Quick start

Requirements: Node 20.9+ (24 recommended), pnpm 10 (`corepack enable`).

```bash
pnpm bootstrap     # install, create .env with a generated secret, migrate SQLite, validate content, install Chromium
pnpm dev           # http://localhost:3000
```

Other commands:

| Command | What it does |
|---|---|
| `pnpm test` | Vitest: domain logic, journey helpers, sync server logic (real SQLite in a temp file), integration contracts |
| `pnpm test:e2e` | Playwright against the production build on port 3100 (run `pnpm build` first): onboarding, practice modes, mocks, journey, English, readiness, accounts, settings, offline, accessibility |
| `pnpm verify` | Everything in order, nonzero on any failure, evidence written to `.harness/evidence/latest.json` |
| `pnpm verify:quick` | Content, typecheck, lint, unit tests |
| `pnpm content:ingest` / `pnpm content:validate` | Regenerate and check the question packs from the official PDFs |
| `pnpm db:migrate` / `pnpm db:deploy` | Prisma migrations (dev / production) |

## Design

The interface follows the OathSteps Claude Design handoff screen for screen: Inter, a compact `.o-*` design system (teal primary, amber for uncertainty, forest for confirmed, no error red), bottom tabs on phones and top tabs on wide screens via container queries, bottom sheets, toasts with undo, and a dark theme (Settings › Appearance). "Demo" labels appear only when the fictional demo learner is loaded.

## Layout

```
content/      official sources + hashes, ingest/validate scripts, generated packs, guide, English tasks
src/domain/   pure tested logic: dates, test path, mock machine, scheduler, plan, readiness, answers
src/lib/      IndexedDB store, content/guide loaders, route wording, Today plan, speech, sync client, offline, demo learner
src/components/ design-system shell (Screen, Overlay, icons, sheets)
src/server/   Prisma, Better Auth, sync/account handlers, integration contracts
src/app/      Next.js App Router screens and API routes
public/sw.js  service worker (never caches /api)
tests/e2e/    Playwright specs
docs/         OPERATIONS, CONTENT, INTEGRATIONS
.harness/     feature ledger, progress, decisions, evidence
```

## Deployment

Step-by-step setup with Cloudflare Tunnel (or Caddy), free Brevo email, GitHub Pages for the legal pages, backups and rollback: [docs/DEPLOY.md](docs/DEPLOY.md). `pnpm release:check` lists what still blocks a public launch. Content review: [content/review/REVIEW.md](content/review/REVIEW.md).

`docker compose up -d --build` runs migrations and then the app with SQLite on a persistent volume. See [docs/OPERATIONS.md](docs/OPERATIONS.md) for environment variables, backup/restore, the PostgreSQL migration path and open release gates, [docs/CONTENT.md](docs/CONTENT.md) for content updates and rollback, and [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) for the speech, USCIS status, payments and push adapters that are contract-only in this release.

## Status

See `.harness/features.json` for the feature ledger with verification status and `.harness/progress.md` for the current state. Items that remain owner decisions: qualified content review, production mail provider, hosting, and any conditional integration.
