# Deploying OathSteps

This is the shortest dependable path: one small Linux server running Docker, with Caddy in front for automatic HTTPS. It matches what the app needs. SQLite is a single file, so there must be exactly one app instance writing to a persistent disk. That rules out serverless platforms, which have no persistent disk. A managed container host with a persistent volume (for example Fly.io) also works, but it is not covered here.

`pnpm release:check` lists what still blocks a public launch. Run it on the server when you finish.

## 1. What you need

- A domain or subdomain, for example `study.example.org`.
- A small server: 1 vCPU and 1 GB of memory is enough for this app. Any Linux VPS provider works.
- A mail provider account. This guide uses Resend (https://resend.com); the code is a single function, so another provider is a small change in `src/server/mail.ts`.
- A name and a contact email to publish on the Privacy notice and Terms. Use a mailbox that is read.

## 2. DNS

Create an `A` record (and `AAAA` if the server has IPv6) for your domain pointing to the server's IP address. Caddy cannot get a certificate until this resolves.

## 3. Prepare the server

Install Docker Engine and the Compose plugin (https://docs.docker.com/engine/install/). Allow inbound ports 22, 80 and 443 only. Port 80 is needed for certificate issuance and the redirect to HTTPS.

```bash
git clone https://github.com/raychowdhury/oathsteps.git
cd oathsteps
```

## 4. Mail

1. In Resend, add your sending domain and create the DNS records it shows (SPF and DKIM). Wait until it says verified.
2. Create an API key limited to sending.
3. Pick a sender on that domain, for example `OathSteps <no-reply@example.org>`.

## 5. Configuration

Create `.env` in the repository folder. Generate the secret with `openssl rand -base64 32`. Never commit this file.

```bash
DOMAIN=study.example.org
APP_URL=https://study.example.org
BETTER_AUTH_SECRET=<output of openssl rand -base64 32>

MAIL_PROVIDER=resend
RESEND_API_KEY=<your key>
MAIL_FROM=OathSteps <no-reply@example.org>

LEGAL_ENTITY=<who runs the service>
LEGAL_CONTACT_EMAIL=<a mailbox you read>
LEGAL_JURISDICTION=<for example "the State of New York, USA">
# Leave LEGAL_REVIEWED_ON empty until a lawyer signs off. The pages then show "Draft".
```

The server refuses to start in production with a missing or weak secret, a non-HTTPS public address, or a mail provider without its key. The error is in `docker compose logs app`.

## 6. Start

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
```

The first start builds the image, applies database migrations, then starts the app and Caddy. Caddy requests the certificate on the first visit to the domain.

## 7. Check it

```bash
curl -fsS https://study.example.org/api/health      # {"status":"ok"}
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml run --rm --no-deps migrate pnpm release:check
```

The second command runs the launch check inside the build image with the same `.env` as the app. It lists every gate that is still open: mail, public address, the operator details, the lawyer review of the Privacy notice and Terms, and the expert review of each content scope. It exits with an error until all are closed. That is expected on day one.

Then in a browser: create an account and confirm the email arrives; use "Forgot your password?"; open `/privacy` and `/terms`.

## 8. Backups

The database is `/data/oathsteps.db` in the `oathsteps-data` volume. Back it up daily with SQLite's online backup, copy the file off the server, and keep a rotation. Account deletion removes live data at once; backups keep it until they rotate out, which the Privacy notice says.

```bash
# /etc/cron.d/oathsteps  (daily at 03:15; adjust the path)
15 3 * * * root cd /srv/oathsteps && docker compose exec -T app node -e "require('better-sqlite3')('/data/oathsteps.db').backup('/data/backup-'+new Date().toISOString().slice(0,10)+'.db').then(()=>process.exit(0))" && find /var/lib/docker/volumes -name 'backup-*.db' -mtime +30 -delete
```

Copy the `backup-*.db` files off the server (object storage, another machine). A backup that lives only on the same disk is not a backup. To restore, stop the app, copy a backup over `/data/oathsteps.db`, start the app.

## 9. Updating and rolling back

```bash
git pull
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
```

Migrations run automatically before the app starts. To roll back, `git checkout <previous tag or commit>` and run the same command. Migrations in this project only add tables and columns, so the previous version keeps working against a newer database. Take a backup before any update.

## 10. Monitoring

Point an uptime monitor at `https://study.example.org/api/health` and alert on failure. The app logs errors only, never learner data. Docker keeps the last 50 MB of logs per container (`docker compose logs`).

## Not covered

PostgreSQL and more than one app instance (see OPERATIONS.md), a CDN, and any integration that is still a disabled placeholder (speech scoring, USCIS case status, payments, push).
