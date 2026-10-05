# Progress

state: complete
next action: owner gates only (see "Open findings"); `pnpm release:check` lists them. On any code change rerun `pnpm verify`, then `node scripts/ledger.mjs verify <ids> --checks content,typecheck,lint,unit,build,e2e`

## Current slice
Done. All 25 `track: core` features (F-001 … F-025) are `verified` with evidence for commit d96053e (`pnpm verify`, full mode, clean tree). The stamp itself lands in the following commit, which changes only `.harness/*`. F-025 is the release-readiness slice: production mail, password reset, startup config guard, container deployment with HTTPS, legal pages, expert-review gate, `release:check`.

## Latest verified (2026-10-05, commit d96053e)
- `pnpm content:validate`, `pnpm typecheck`, `pnpm lint`: clean.
- `pnpm test`: 115 unit tests pass (mail transports incl. Brevo, production config guard, legal info and shared legal text, release gates, review records).
- `pnpm build`: passes. `pnpm audit --prod`: no known vulnerabilities (two transitive advisories cleared with pnpm overrides).
- `pnpm test:e2e`: 32 browser tests pass against the production build (phone and desktop). New: legal pages and links, the health endpoint, and the forgot-password round trip through the dev mail sink. The accessibility sweep now includes `/account/reset`, `/privacy` and `/terms`.
- Container, run locally on Docker Desktop on 2026-10-05: `bash scripts/docker-smoke.sh` passes (stack healthy, sign-up writes to the database as the unprivileged user, auth rate limiter returns 429, mail sink writes). The production overlay was also run with Caddy on `localhost`: HTTPS served, HTTP redirects, HSTS and CSP present, cross-origin sign-up refused, weak-secret start refused. `release:check` run inside the image reports exactly the human gates.
- Defect found only by running the image, now fixed: the migrate step created a database the app user could not write (`SQLITE_READONLY`). CI now runs the smoke test.
- Fresh clone of origin/main (commit 4760245): `bash scripts/bootstrap.sh --no-browsers`, `pnpm build` and `pnpm start` succeed. This earlier found that `.env.example` was gitignored.
- CI was green on a64eca9 including the container smoke test and the dependency audit. CI for d96053e is checked after the push.
- Cloudflare overlay run locally with a fake token (2026-10-05): app healthy, `TRUSTED_IP_HEADER` set, `cloudflared` starts and rejects the token, and sign-in rate limits are counted per client IP (one client blocked after 3 attempts, another unaffected). A live tunnel needs the owner's Cloudflare account and a domain.
- Review packet: `pnpm content:review-packet` writes a 42-page Letter landscape PDF (check boxes, comment columns, sign-off page); checked page by page for layout and blank pages.
- Manual walkthrough (dev server, 2026-10-05): 375px phone and 1280px desktop, light and dark; Today, Setup, Practice, recall card, mock, Interview hub, Journey, Guide, Settings render as in the design handoff.

## Open findings (owner decisions, not code gaps)
- Expert review of content has not happened. Packets come from `pnpm content:review-packet`; the procedure and record format are in `content/review/REVIEW.md`. Until records exist the UI says "machine-checked, not yet expert-reviewed".
- Privacy notice and Terms are drafts written from what the code stores. They show "Draft" until a lawyer reviews them and `LEGAL_REVIEWED_ON` is set. They are not legal advice.
- Brevo delivery was verified live on 2026-10-05: a test email sent through `deliverMail` from a Brevo-verified sender reached the owner's inbox. Resend is unit-tested against a mock only. After the first deploy, send one real confirmation email to check the server's settings. Without an authenticated domain, Brevo sends from its shared domain and Outlook/Hotmail may filter to spam. The only verified sender is the owner's personal address; add an address on an owned domain before launch.
- Hosting: `docs/DEPLOY.md` covers Cloudflare Tunnel (needs the owner's Cloudflare account and a domain) or Caddy on a public server. Cloudflare Pages/Workers cannot host this app (SQLite, Node server). The machine that runs Docker is the owner's choice.
- Legal pages are also published by GitHub Pages (`.github/workflows/pages.yml`), as drafts naming the project and pointing to GitHub issues, until repository variables are set.
- Off-server backups, an uptime monitor and the mail domain's SPF/DKIM records cannot be checked by software.
- Conditional integrations (speech provider, USCIS case status, payments, push) remain disabled contracts. Voice practice uses the browser's Web Speech API and is labeled experimental.
- Browser tests ran in Chromium only. Safari, Firefox and a real phone are untested. There is no native iOS app, only the installable web app.

## Resume procedure
1. Read this file, `.harness/features.json` and `.harness/decisions.md`.
2. `pnpm verify:quick` to confirm the tree still passes.
3. Any change to code or content: `pnpm verify`, then re-stamp the touched features. Update this file at every checkpoint.
