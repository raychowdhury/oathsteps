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
