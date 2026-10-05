# Decisions and blockers

Each entry: date, decision, why, consequence. Newest first.

## 2026-10-05

- **2008 and 65/20 mock stop rule: stop at 6 correct or 5 incorrect.** The build prompt only states "up to 10 asked, 6 correct to pass". Stopping once the outcome is decided is the only way "up to 10" can be true; the rule is documented in the UI as the app's practice format, not as a quotation of USCIS policy.
- **Uncertain answers in a mock count as not-correct for the official-format result** and are reported separately. The real test has no "uncertain"; inflating the pass count would be dishonest.
- **Addy Osmani-style standalone skills, Better Auth 1.7.7, Prisma 7.10 with `@prisma/adapter-better-sqlite3`, Next.js 16.3.8, React 19.2, Tailwind 4, Vitest 5, Playwright 1.63, TypeScript 5.9** pinned by pnpm lockfile. TypeScript 7 (Go port) was skipped because `eslint-config-next` and `tsx` are validated against 5.x.
- **Dynamic answers are never generated.** 18 questions across both banks (officeholders, state capital, party, justice count) carry an official lookup URL; the learner records a confirmed value with region and date. Until confirmed they are shown with a verify prompt and are unscored in mocks and excluded from multiple choice.
- **The 2008 bank's question 39 (number of justices) is treated as dynamic** because the official 2019 PDF itself redirects to uscis.gov/citizenship/testupdates.
- **Content review level is "machine-checked, not human-reviewed"** and is shown in the app. The validator fails if a pack claims human review without a reviewer record.
- **Federal Register and eCFR pages were retrieved as client-rendered shells.** Hashes and URLs are kept as retrieval records; the rules were cross-checked against the two USCIS PDFs and the research report. Logged as a content-ops follow-up, not a blocker.
- **Repo directory name contains spaces and a trailing hyphen.** `create-next-app` was run in a scratch folder and copied in; the package name is `oathsteps`.
- **Guest data lives in IndexedDB (idb); server data in SQLite via Prisma.** Sync is an append-only event log keyed by client-generated UUIDs, so replays are idempotent.
- **Conditional integrations (speech, USCIS status, payments, push) ship as adapter contracts and documentation only.** No credentials were provided, so no provider code runs.
- **No background notifications are promised.** Reminders are in-app due lists plus `.ics` export.

## Blockers

- None that stop core work. Human/legal content review, production mail provider, hosting destination, and conditional-integration credentials are release gates owned by the project owner.

## 2026-10-05 (design handoff)

- **Design handoff adopted as the UI spec.** `oathsteps-handoff.zip` (Claude Design export) defines screens, states, copy and styles. Ported class-for-class (`.o-*` system, Inter, container-query desktop layout, sheets, toasts, five-step setup, seven milestone slots, four-stage guide, interview hub with voice/reading/writing/instructions/N-400). The prototype's 14 sample questions are replaced by the full official banks, and its in-memory state by the IndexedDB store and domain modules already built.
- **"No backend" in the handoff's suggested prompt is the prototype's scope, not the product's.** The build prompt requires optional accounts with consented migration and sync, which exist and are tested. Guest study remains complete with no server; the Account card in Settings is the only addition not in the design.
- **"Demo" labels show only when the fictional demo learner is loaded** ("Explore with a demo learner's history" on Welcome, "Demo data" in Settings). Real guest data is never labeled demo. Copy that said "Prototype: …" becomes a true statement where the feature is real (exports create a file, reports are saved, reminders show in the app) and is dropped where it was only a prototype limitation.
- **Voice** uses the browser's own speech recognition (Web Speech API) where available, with a consent sheet that says audio may be processed by the browser vendor's service and that OathSteps records nothing. Results are labeled "experimental" and the transcript is matched deterministically against the accepted answers; the learner always grades. Where the API is unavailable or the mic is denied, the typed and self-check paths remain. This replaces the prototype's "Simulated" tag.
- **Coach pass** shows the proposal exactly as designed ("Pricing experiment · not a live offer") but with no checkout, because no payment provider is configured. The simulated-checkout screen is not built.
- **Study language step** keeps the design's list but only English is selectable; other languages read "Not yet available" until a reviewed translation exists.
- **Sample walkthrough (5 questions, stop at 4 correct / 3 wrong)** is added next to the full-format mock; both use the same mock state machine with different rules.
- **Journey model changed** from a free list of milestone events to the design's seven fixed slots with status and date; the previous model was never shipped.

## 2026-10-05 (release readiness)

- **Mail:** Resend over plain `fetch` (no dependency) plus the existing development sink. Chosen because it is one HTTPS call and any other provider is a small branch in `deliverMail`. Not exercised against a live account; unit-tested against a mocked call. Sign-up and reset emails are fire-and-forget so a provider outage cannot break sign-up or leak whether an address exists.
- **Password reset:** the server already had `sendResetPassword`; no screen could trigger it, so a learner who forgot a password lost their synced data. Added the request form on `/account` and `/account/reset`. Sessions are revoked on reset.
- **Startup guard:** `assertConfig` runs from `instrumentation.ts` in production only and refuses weak secrets, non-https public addresses and half-configured mail. Local addresses are exempt so CI and local Docker are unaffected.
- **Hosting:** one VPS with Docker and Caddy (automatic HTTPS), because SQLite needs one writer on a persistent disk. The base compose now publishes on loopback only; the overlay in `deploy/` adds Caddy and resource limits.
- **Defect found only by running the image:** `migrate` ran as root and created a database the unprivileged app user could not write (`SQLITE_READONLY`). CI had only built the image. Fixed by chowning `/data` to uid 1001 after migration and by adding `scripts/docker-smoke.sh` (sign-up must write) to CI.
- **Legal pages:** drafted from what the code stores, in plain language, and shown with a "Draft, not reviewed by a lawyer" notice until `LEGAL_REVIEWED_ON` is set. Operator details are read from the environment at request time. They are not legal advice and not a substitute for review.
- **Content review:** a review is a record bound to the content hash. The pack hash now excludes the `review` block (so a record can name it); pack `version` strings changed once as a result. Reviewer names stay in records; the app shows only credential and date. Without a qualified reviewer none of this flips on its own.
- **Dependencies:** pnpm overrides raise `mysql2` (better-auth's unused optional MySQL adapter) and `deepmerge-ts` (Prisma config loader) past published advisories; `pnpm audit --prod` is now clean and runs in CI at `high`.
