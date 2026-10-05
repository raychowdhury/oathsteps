# Progress

state: complete
next action: owner gates only (see "Open findings"); on any code change rerun `pnpm verify`, then `node scripts/ledger.mjs verify <ids> --checks content,typecheck,lint,unit,build,e2e`

## Current slice
Done. Every `track: core` feature (F-001 … F-024) is `verified` with evidence recorded for commit 2359d27 (`pnpm verify`, full mode, clean tree). The ledger stamp itself lands in the following commit, which changes only `.harness/*`.

## Latest verified (2026-10-05, commit 2359d27)
- `pnpm content:validate`: 2025 pack 128 questions / 20 designated 65-20 / 8 dynamic; 2008 pack 100 / 20 / 10; source hashes match `SOURCES.json`; guide stages link only to listed official sources.
- `pnpm typecheck`, `pnpm lint`: clean.
- `pnpm test`: 78 unit tests pass (routing boundary 2025-10-19 vs 2025-10-20, full and walkthrough stop rules, answer matching, writing word diff, filing/interview/milestone validation, journey slots and .ics, scheduler, plan, readiness, sync server, same-origin guard, integrations, i18n).
- `pnpm build`: production build passes.
- `pnpm test:e2e`: 29 browser tests pass against the production build (phone 375px and desktop 1280px projects): onboarding and routing, practice modes and sheets, dynamic answers, walkthrough and full mocks incl. pause/resume and 2008 path, interview reading/writing/instructions/N-400/voice fallbacks, readiness, journey milestones/guide/reminders/.ics, settings export/reset/delete, offline download, accounts with migration/sync/sign-out/delete, security headers and cross-origin rejection, axe sweep in light and dark with no serious or critical violations, keyboard-only card.
- Fresh clone of origin/main (2026-10-05, commit 4760245): `bash scripts/bootstrap.sh --no-browsers`, `pnpm build` and `pnpm start` succeed; main routes, manifest and service worker return 200; security headers present; cross-origin sign-up returns 403. This found `.env.example` was gitignored; fixed in 4760245.
- CI on 99fafdd: all jobs green, including `docker build --target runner` and the browser suite, so the Docker image build is verified there.
- Manual walkthrough (dev server, 2026-10-05): 375px phone and 1280px desktop, light and dark; Today, Setup, Practice, recall card, mock, Interview hub, Journey, Guide, Settings render as in the design handoff.

## Open findings (owner decisions, not code gaps)
- Content is machine-checked only; a qualified reviewer has not signed off on wording, guide text or English tasks. The UI says so.
- Docker image build could not run on this machine (daemon off); CI built the `runner` target successfully on 99fafdd.
- Production mail provider, hosting and `BETTER_AUTH_SECRET` are owner-provisioned. Dev uses the mail sink directory.
- Conditional integrations (speech provider, USCIS case status, payments, push) ship as disabled contracts with tests; the UI never presents them as working.
- Voice practice uses the browser's Web Speech API and is labeled experimental; typed and self-check paths are the supported fallbacks.

## Resume procedure
1. Read this file, `.harness/features.json` and `.harness/decisions.md`.
2. `pnpm verify:quick` to confirm the tree still passes.
3. Any change to code or content: `pnpm verify`, then re-stamp the touched features. Update this file at every checkpoint.
