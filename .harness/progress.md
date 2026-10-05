# Progress

state: complete
next action: owner gates only (see "Open findings"); `pnpm release:check` lists them. On any code change rerun `pnpm verify`, then `node scripts/ledger.mjs verify <ids> --checks content,typecheck,lint,unit,build,e2e`

## Current slice
Done. All 25 `track: core` features (F-001 … F-025) are `verified` with evidence for commit dac6ef0 (`pnpm verify`, full mode, clean tree). The stamp itself lands in the following commit, which changes only `.harness/*`. F-025 is the release-readiness slice: production mail, password reset, startup config guard, container deployment with HTTPS, legal pages, expert-review gate, `release:check`.

## Latest verified (2026-10-05, commit dac6ef0)
- `pnpm content:validate`, `pnpm typecheck`, `pnpm lint`: clean.
- `pnpm test`: 102 unit tests pass (adds mail transports, production config guard, legal info, release gates, review records).
- `pnpm build`: passes. `pnpm audit --prod`: no known vulnerabilities (two transitive advisories cleared with pnpm overrides).
- `pnpm test:e2e`: 32 browser tests pass against the production build (phone and desktop). New: legal pages and links, the health endpoint, and the forgot-password round trip through the dev mail sink. The accessibility sweep now includes `/account/reset`, `/privacy` and `/terms`.
- Container, run locally on Docker Desktop on 2026-10-05: `bash scripts/docker-smoke.sh` passes (stack healthy, sign-up writes to the database as the unprivileged user, auth rate limiter returns 429, mail sink writes). The production overlay was also run with Caddy on `localhost`: HTTPS served, HTTP redirects, HSTS and CSP present, cross-origin sign-up refused, weak-secret start refused. `release:check` run inside the image reports exactly the human gates.
- Defect found only by running the image, now fixed: the migrate step created a database the app user could not write (`SQLITE_READONLY`). CI now runs the smoke test.
- Fresh clone of origin/main (commit 4760245): `bash scripts/bootstrap.sh --no-browsers`, `pnpm build` and `pnpm start` succeed. This earlier found that `.env.example` was gitignored.
- CI on 99fafdd was green including the Docker build. CI for the commits after it has not been checked yet.
- Manual walkthrough (dev server, 2026-10-05): 375px phone and 1280px desktop, light and dark; Today, Setup, Practice, recall card, mock, Interview hub, Journey, Guide, Settings render as in the design handoff.

## Open findings (owner decisions, not code gaps)
- Expert review of content has not happened. Packets come from `pnpm content:review-packet`; the procedure and record format are in `content/review/REVIEW.md`. Until records exist the UI says "machine-checked, not yet expert-reviewed".
- Privacy notice and Terms are drafts written from what the code stores. They show "Draft" until a lawyer reviews them and `LEGAL_REVIEWED_ON` is set. They are not legal advice.
- Resend delivery is unit-tested against a mocked call only. It needs your Resend account, a verified sending domain and one real test email after the first deploy.
- Hosting is not chosen. `docs/DEPLOY.md` is a tested path for one VPS with Docker and Caddy; DNS, the server and the real certificate are yours.
- Off-server backups, an uptime monitor and the mail domain's SPF/DKIM records cannot be checked by software.
- Conditional integrations (speech provider, USCIS case status, payments, push) remain disabled contracts. Voice practice uses the browser's Web Speech API and is labeled experimental.
- Browser tests ran in Chromium only. Safari, Firefox and a real phone are untested. There is no native iOS app, only the installable web app.

## Resume procedure
1. Read this file, `.harness/features.json` and `.harness/decisions.md`.
2. `pnpm verify:quick` to confirm the tree still passes.
3. Any change to code or content: `pnpm verify`, then re-stamp the touched features. Update this file at every checkpoint.
