# Operating OathSteps

## Runtime and versions

| Component | Version (pinned by `pnpm-lock.yaml`) |
|---|---|
| Node.js | 24 LTS (minimum 20.9) |
| pnpm | 10.28 |
| Next.js / React | 16.3.8 / 19.2 |
| Prisma | 7.10 with `@prisma/adapter-better-sqlite3` |
| Better Auth | 1.7.7 |
| Vitest / Playwright | 5.0 / 1.63 |

## Environment

Copy `.env.example` to `.env`. Variables:

| Name | Purpose |
|---|---|
| `BETTER_AUTH_SECRET` | 32+ random characters. `openssl rand -base64 32`. Rotating it invalidates sessions. |
| `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` | Public origin (https in production). Used for cookies, trusted origins and mail links. |
| `DATABASE_URL` | `file:` path to the SQLite database. Must be on durable storage. |
| `MAIL_PROVIDER` | `resend` for production delivery. Empty keeps the development sink. |
| `RESEND_API_KEY`, `MAIL_FROM` | Required with `MAIL_PROVIDER=resend`. `MAIL_FROM` is an address on a domain verified at the provider. |
| `AUTH_RATE_LIMIT` | `off` disables the sign-in and sign-up rate limiter. For the browser tests only; the server refuses it on a public address. |
| `MAIL_SINK_DIR` | Development mail sink. Verification and reset emails are written here as `.eml` files. |
| `LEGAL_ENTITY`, `LEGAL_CONTACT_EMAIL`, `LEGAL_JURISDICTION` | Shown on the Privacy notice and Terms. Read at request time. |
| `LEGAL_REVIEWED_ON` | `YYYY-MM-DD` a lawyer signed off on the Privacy notice and Terms. Empty keeps the "Draft" notice. |
| `SPEECH_PROVIDER`, `USCIS_STATUS_PROVIDER`, `PAYMENTS_PROVIDER`, `PUSH_PROVIDER` | `disabled` in this release; any other value fails startup until an adapter exists. See `INTEGRATIONS.md`. |

Secrets are generated locally and never committed; `.env` is gitignored and excluded from the Docker build context. `.env.example` is committed and holds only placeholders.

In production (`NODE_ENV=production`) the server checks its configuration at startup (`src/instrumentation.ts`, `src/server/config.ts`) and refuses to start with a missing or weak `BETTER_AUTH_SECRET`, a public address that is not https, mismatched public origins, or `MAIL_PROVIDER=resend` without its key and sender. It logs a warning when a public deployment has no real mail provider or no operator named. Local addresses are exempt, so development, CI and local Docker stay quiet.

## Running

- Local development: `pnpm bootstrap` once, then `pnpm dev`.
- Production (container): follow [DEPLOY.md](DEPLOY.md). Short form: `docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build` with a `.env` holding `DOMAIN`, `APP_URL`, `BETTER_AUTH_SECRET` and the mail and legal settings. The `migrate` service applies Prisma migrations to the shared volume, hands the database to the unprivileged app user, and exits; `app` starts after it succeeds; Caddy terminates TLS. Without the overlay, the app is published on loopback only (`127.0.0.1:3000`).
- Production (bare Node): `BUILD_STANDALONE=1 pnpm build`, copy `.next/standalone`, `.next/static` into `.next/standalone/.next/static`, and `public` into `.next/standalone/public`, run `pnpm db:deploy` against the production `DATABASE_URL`, then `node server.js`.

Put a TLS-terminating reverse proxy in front (the overlay uses Caddy and adds HSTS). The app sets its own security headers (CSP, frame-ancestors none, nosniff, referrer policy).

`GET /api/health` returns `{"status":"ok"}` after a database query, or 503. The container health check and uptime monitors use it.

## SQLite durability, backup and restore

SQLite is a single-file database. It is only safe when:

- the file lives on a persistent volume (compose: `oathsteps-data` mounted at `/data`), never on an ephemeral or serverless filesystem;
- exactly one app instance writes to it.

**Backup** (consistent even while the app runs, using SQLite's online backup):

```bash
docker compose exec app node -e "require('better-sqlite3')('/data/oathsteps.db').backup('/data/backup-'+Date.now()+'.db').then(()=>console.log('ok'))"
docker compose cp app:/data/ ./backups/
```

Keep the `/data/mail` folder out of backups unless you need it. Rotate backups on a schedule and delete old ones; account deletion removes live data immediately but backups persist until rotated, which is what the in-app deletion notice says.

**Restore**: stop the app, copy the backup file over `/data/oathsteps.db`, start the app. Migrations are idempotent, so `migrate` can run again safely.

## Moving to PostgreSQL

Changing only `DATABASE_URL` does not migrate between providers. The honest path:

1. Change `datasource.provider` in `prisma/schema.prisma` to `postgresql`, swap `@prisma/adapter-better-sqlite3` for `@prisma/adapter-pg` in `src/server/prisma.ts`, and set `provider: "postgresql"` in the Better Auth adapter in `src/server/auth.ts`.
2. Delete `prisma/migrations` and create a fresh initial migration for PostgreSQL (`pnpm db:migrate`). SQLite migration SQL is not portable.
3. Export data from SQLite (`sqlite3 oathsteps.db .dump` or a script over Prisma) and import into PostgreSQL, mapping types (`DateTime` columns are stored as ISO text in SQLite via Prisma; they become `timestamp` in PostgreSQL).
4. Re-run `pnpm verify` and the account browser tests against the new database before switching traffic.
5. Remove the single-instance assumption: the in-memory rate limiter in `src/server/sync.ts` should move to a shared store if you run more than one app instance.

## Mail

`src/server/mail.ts` has two transports, chosen by `MAIL_PROVIDER`: `resend` (production; HTTPS call to the Resend API with a 10 second timeout) and the development sink (`.eml` files in `MAIL_SINK_DIR`, used by the browser tests). With neither configured, sending fails loudly. Another provider is one more branch in `deliverMail`.

Sign-up confirmation and password-reset emails are sent without blocking the request, so a provider outage cannot break sign-up or reveal whether an address has an account. A failure is logged as `[mail] not delivered: <reason>` with no address. Sign-up does not require a confirmed email. Password reset (Account, "Forgot your password?") needs working mail; it signs the user out of every device when the password changes.

The Resend path is covered by unit tests against a mocked HTTP call. It has not been exercised against a live Resend account, because that needs your account and a verified domain. Send yourself a confirmation email after the first deploy.

## Content updates and rollback

See `CONTENT.md`. In short: `pnpm content:ingest` regenerates packs from the official PDFs in `content/sources/`, `pnpm content:validate` must pass, and the pack `version` (bank + content hash) is stored on every attempt so old results stay interpretable. Rolling back is a git revert of `content/` plus a redeploy; learner data is unaffected.

## Logs and privacy

The server logs request errors only. Learning payloads, emails and dates are not logged. Browser-side data never leaves the device unless the learner creates an account and consents to migration. The app collects no SSN, A-number, USCIS credentials, identity documents or N-400 answers.

## Release gates

`pnpm release:check` (or `docker compose ... run --rm --no-deps migrate pnpm release:check` on the server) prints which gates are open and exits nonzero until all are closed:

- A valid secret and a public https address.
- A production mail provider.
- The operator named on the Privacy notice and Terms, and `LEGAL_REVIEWED_ON` set after a lawyer reviews them.
- Expert review recorded for each content scope (`content/review/REVIEW.md`).

Not machine-checkable: DNS records for the mail domain, scheduled off-server backups, an uptime monitor. Any conditional integration (speech, USCIS status, payments, push) and its credentials and authorizations stay out of scope until an adapter exists.
