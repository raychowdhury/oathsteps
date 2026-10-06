# Progress

state: complete
next action: owner gates only (see "Open findings"); `pnpm release:check` lists them. On any code change rerun `pnpm verify` (on a Mac it includes the iOS checks), then `node scripts/ledger.mjs verify <ids> --checks content,typecheck,lint,unit,build,e2e` (add `,ios-core,ios-ui` for F-026)

## Current slice
Done. All 26 `track: core` features (F-001 … F-026) are `verified` with evidence for commit 160226b (`pnpm verify`, full mode, clean tree, iOS checks included). The stamp itself lands in the following commit, which changes only `.harness/*`. F-026 is the native iPhone app (`ios/`, SwiftUI) with parity to the web app; see `ios/README.md`.

## Latest verified (2026-10-05, commit 160226b)
- `pnpm verify` full mode on a clean tree: content, typecheck, lint, 119 unit tests, build, 35 browser tests (phone and desktop), 77 Swift core tests, 6 iPhone UI tests on the iOS 26.5 simulator (setup and test path, practice card, walkthrough stop rule, journey and guide, settings data controls with typed DELETE, light and dark tour, and an account sign-up, consented migration, sync and deletion against the local server with a bearer token).
- Native walkthrough screenshots (light and dark: Today, Practice, Interview, Journey; plus Welcome, practice card, walkthrough results, guide, settings, account) are attachments in the UI test result bundle (`ios/build/ui.xcresult`, uploaded by CI).
- Found and fixed during the native work: the sync server rejected `journey` events (whole batches failed for anyone with a milestone date); Better Auth's 5-minute session cookie cache kept a deleted account's session usable for sync on clients that keep cookies; stored cookies made the iOS app's next sign-in fail with 403; dates were shown as the UTC day (a day ahead on US evenings) in both apps; web Clear demo left the fictional interview date and checklist; a main-actor color closure crashed the iOS app when SwiftUI resolved colors on its render thread; an unreadable iOS data file would have been overwritten (now kept aside).

## Earlier verification (2026-10-05, commit d96f5b1)
- `pnpm content:validate`, `pnpm typecheck`, `pnpm lint`: clean.
- `pnpm test`: 117 unit tests pass (mail transports incl. Brevo, production config guard, legal info and shared legal text, release gates, review records, Home Screen tip detection).
- `pnpm build`: passes. `pnpm audit --prod`: no known vulnerabilities (two transitive advisories cleared with pnpm overrides).
- `pnpm test:e2e`: 34 browser tests pass (adds the iOS Home Screen tip with an iPhone user agent) against the production build (phone and desktop). New: legal pages and links, the health endpoint, and the forgot-password round trip through the dev mail sink. The accessibility sweep now includes `/account/reset`, `/privacy` and `/terms`.
- Container, run locally on Docker Desktop on 2026-10-05: `bash scripts/docker-smoke.sh` passes (stack healthy, sign-up writes to the database as the unprivileged user, auth rate limiter returns 429, mail sink writes). The production overlay was also run with Caddy on `localhost`: HTTPS served, HTTP redirects, HSTS and CSP present, cross-origin sign-up refused, weak-secret start refused. `release:check` run inside the image reports exactly the human gates.
- Defect found only by running the image, now fixed: the migrate step created a database the app user could not write (`SQLITE_READONLY`). CI now runs the smoke test.
- Fresh clone of origin/main (commit 4760245): `bash scripts/bootstrap.sh --no-browsers`, `pnpm build` and `pnpm start` succeed. This earlier found that `.env.example` was gitignored.
- CI was green on a64eca9 including the container smoke test and the dependency audit. CI for d96053e is checked after the push.
- Cloudflare overlay run locally with a fake token (2026-10-05): app healthy, `TRUSTED_IP_HEADER` set, `cloudflared` starts and rejects the token, and sign-in rate limits are counted per client IP (one client blocked after 3 attempts, another unaffected). A live tunnel needs the owner's Cloudflare account and a domain.
- iPhone pass on the iOS 26.5 simulator (2026-10-05), Safari and installed Home Screen app: onboarding with the native date picker, Today, practice card, reveal and grading, sheets, voice page, install flow (name and icon correct), standalone detection, data kept across app restarts. Found and fixed: date fields overflowing, light page behind Safari's bars in dark mode, action bar under the home indicator. Found: installed app starts with empty storage; the tip now says so.
- Backup and restore round trip verified against a running container: backup passes its integrity check, restore brings back exactly the backed-up data, keeps a safety copy, and the app still writes afterwards.
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
- Automated browser tests run in Chromium. iPhone Safari was checked by hand in the iOS 26.5 simulator; a real phone, Firefox and desktop Safari are untested, and microphone input was not tested.
- Native iPhone app: tested only in the simulator. A real iPhone (microphone and on-device speech, notification delivery, VoiceOver, largest text sizes) is untested. App Store release needs the owner's Apple Developer account and team ID. Release builds are guest-only until the deployed HTTPS address is set as `OATHSTEPS_API_BASE_URL` (ios/README.md, "Before the App Store"). The iOS CI job (`.github/workflows/ios.yml`, macos-26 runner) is new; its first run is checked after the push.
- Request emails for the reviewer and the lawyer are drafted in `content/review/OUTREACH.md`; sending them is the owner's step.

## Resume procedure
1. Read this file, `.harness/features.json` and `.harness/decisions.md`.
2. `pnpm verify:quick` to confirm the tree still passes.
3. Any change to code or content: `pnpm verify`, then re-stamp the touched features. Update this file at every checkpoint.
