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
| `MAIL_SINK_DIR` | Development mail sink. Verification and reset emails are written here as `.eml` files. |
| `SPEECH_PROVIDER`, `USCIS_STATUS_PROVIDER`, `PAYMENTS_PROVIDER`, `PUSH_PROVIDER` | `disabled` in this release; any other value fails startup until an adapter exists. See `INTEGRATIONS.md`. |

Secrets are generated locally and never committed; `.env` is gitignored and excluded from the Docker build context.

## Running

- Local development: `pnpm bootstrap` once, then `pnpm dev`.
- Production (container): `docker compose up -d --build`. The `migrate` service applies Prisma migrations to the shared volume and exits; `app` starts after it succeeds. Set `BETTER_AUTH_SECRET` and `APP_URL` in a `.env` next to the compose file.
- Production (bare Node): `BUILD_STANDALONE=1 pnpm build`, copy `.next/standalone`, `.next/static` into `.next/standalone/.next/static`, and `public` into `.next/standalone/public`, run `pnpm db:deploy` against the production `DATABASE_URL`, then `node server.js`.

Put a TLS-terminating reverse proxy in front (Caddy, nginx). The app sets its own security headers (CSP, frame-ancestors none, nosniff, referrer policy).

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

Only the development sink is implemented. Production needs a provider (SMTP relay, SES, Postmark, Resend, ...): implement `deliverMail` in `src/server/mail.ts` to call it when `MAIL_SINK_DIR` is unset, and keep the sink for tests. Until then, email verification and password reset links are written to `MAIL_SINK_DIR` and the app refuses to pretend mail was sent. Sign-up does not require verification, so accounts work without a provider.

## Content updates and rollback

See `CONTENT.md`. In short: `pnpm content:ingest` regenerates packs from the official PDFs in `content/sources/`, `pnpm content:validate` must pass, and the pack `version` (bank + content hash) is stored on every attempt so old results stay interpretable. Rolling back is a git revert of `content/` plus a redeploy; learner data is unaffected.

## Logs and privacy

The server logs request errors only. Learning payloads, emails and dates are not logged. Browser-side data never leaves the device unless the learner creates an account and consents to migration. The app collects no SSN, A-number, USCIS credentials, identity documents or N-400 answers.

## Release gates still open

- Qualified human review of question wording, explanations and the guide (content packs say `humanReviewed: false`).
- Production mail provider.
- Hosting destination and TLS.
- Any conditional integration (speech, USCIS status, payments, push) and its credentials and authorizations.
