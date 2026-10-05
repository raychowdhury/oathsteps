# Deploying OathSteps

OathSteps is one Node app with one SQLite file. That shapes the options: it needs a machine that stays on, exactly one copy of the app writing to a persistent disk, and an HTTPS address. `pnpm release:check` lists what still blocks a public launch.

## What it costs

| Piece | Choice | Cost |
|---|---|---|
| HTTPS and public address | Cloudflare Tunnel (Path A) | Free |
| A domain name | Needed for a stable address. Cloudflare Registrar sells at cost; check the current price | The one unavoidable cost, roughly the price of a coffee a month at most |
| Machine that runs Docker | Your own always-on computer, or a small server | Free if you already have one |
| Email (sign-up confirmation, password reset) | Brevo free plan, 300 emails a day | Free |
| Privacy notice and Terms page | GitHub Pages | Free |

**Why not Cloudflare Pages or Workers?** They run code at the edge and have no persistent disk. This app needs a Node server and SQLite, so running it there means rewriting the database layer for Cloudflare D1. That is a separate project. Cloudflare's container hosting needs a paid plan. A tunnel gives you Cloudflare's HTTPS and protection in front of a machine you run.

**Without a domain:** you can look at the app (not sign in) through a temporary Cloudflare address:

```bash
docker run --rm cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://host.docker.internal:3000
```

It prints a random `https://….trycloudflare.com` address that changes every run. Sign-in is refused on it because the app only accepts its configured address. Use it to preview, not to launch.

## Path A. Cloudflare Tunnel (recommended)

`cloudflared` runs next to the app and makes an outbound connection to Cloudflare. Cloudflare serves your domain over HTTPS and forwards requests to the app. You open no inbound ports and manage no certificate.

1. **Cloudflare account and domain.** Create a free account. Add your domain to Cloudflare (change its nameservers as Cloudflare instructs), or register one there.
2. **Create the tunnel.** In the Cloudflare dashboard open Zero Trust, then Networks, then Tunnels, and create a tunnel of type Cloudflared. Copy the tunnel token (the long string after `--token`). Menu names move around; Cloudflare's own guide is https://developers.cloudflare.com/tunnel/setup/.
3. **Add a public hostname** to the tunnel: subdomain `study` (or whatever you like), your domain, service type `HTTP`, URL `app:3000`.
4. **Put the machine in order.** Install Docker, then:

   ```bash
   git clone https://github.com/raychowdhury/oathsteps.git
   cd oathsteps
   ```
5. **Create `.env`** next to `docker-compose.yml`. Generate the secret with `openssl rand -base64 32`. Never commit this file.

   ```bash
   APP_URL=https://study.example.org
   BETTER_AUTH_SECRET=<output of openssl rand -base64 32>
   CLOUDFLARE_TUNNEL_TOKEN=<the token from step 2>

   # Mail: see "Email" below
   MAIL_PROVIDER=brevo
   BREVO_API_KEY=<your Brevo API key>
   MAIL_FROM=OathSteps <the sender address you verified in Brevo>

   # Shown on the Privacy notice and Terms. Keep equal to the GitHub variables (see "Privacy notice and Terms").
   LEGAL_ENTITY=<who runs the service>
   LEGAL_CONTACT_EMAIL=<a mailbox you read, or leave empty>
   LEGAL_CONTACT_URL=https://github.com/raychowdhury/oathsteps/issues
   LEGAL_JURISDICTION=<for example "the State of New York, USA">
   # Leave LEGAL_REVIEWED_ON empty until a lawyer signs off. The pages then show "Draft".

   # Optional: copy each nightly backup off the machine (see "Backups")
   BACKUP_RCLONE_REMOTE=
   ```
6. **Start it:**

   ```bash
   docker compose -f docker-compose.yml -f deploy/docker-compose.cloudflare.yml up -d --build
   ```
7. **In Cloudflare, under SSL/TLS, Edge Certificates,** turn on Always Use HTTPS and HSTS. The app's own pages set no HSTS header, because only the edge knows the address is HTTPS for good.

The overlay sets `TRUSTED_IP_HEADER=cf-connecting-ip` so sign-in rate limits count each visitor separately. That is safe only because the app's port is bound to the machine's loopback and the tunnel is the only way in. Do not change the compose file to publish the app port publicly.

**Where it runs.** If the machine sleeps or loses power the site is down. A laptop is fine for trying it. For real use, use something that stays on.

## Path B. Caddy on a server with a public IP

Use this if you rent a small server and prefer not to use Cloudflare. Point an `A` record for your domain at the server, allow inbound ports 80 and 443, and put `DOMAIN=study.example.org` in `.env` next to the same `APP_URL`, `BETTER_AUTH_SECRET`, mail and legal settings. Then:

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
```

Caddy requests and renews a Let's Encrypt certificate and adds HSTS.

## Email (Brevo, free)

The app sends only two kinds of email: confirm your address, and reset your password. Brevo's free plan allows 300 a day and needs no domain.

1. Create a free account at https://www.brevo.com.
2. Add a sender: Senders, Domains and Dedicated IPs, then Senders, then add the address you want people to see, and click the confirmation link Brevo emails you.
3. Create an API key: SMTP and API, then API keys.
4. Set `MAIL_PROVIDER=brevo`, `BREVO_API_KEY` and `MAIL_FROM` in `.env` (the `MAIL_FROM` address must be the one you verified).

What to expect without a domain of your own: Brevo cannot authenticate a free address such as Gmail, so it sends from its own shared domain. Most inboxes accept that. Outlook and Hotmail may put the message in spam. When you have a domain, authenticate it in Brevo (it shows the DNS records to add) and use an address on it. Delivery improves a lot.

The Brevo code path is covered by unit tests, and one live test email sent through it on 2026-10-05 reached an inbox. After the first deploy, still send yourself a real confirmation email to check the server's own settings.

Alternative: `MAIL_PROVIDER=resend` with `RESEND_API_KEY`. Resend's free tier also works but needs a verified domain.

## Privacy notice and Terms (GitHub Pages)

The same text the app serves at `/privacy` and `/terms` is also published as plain pages by GitHub Pages, so you have a public address to give Brevo, an app store or a reviewer. The workflow `.github/workflows/pages.yml` rebuilds them whenever the legal text changes.

- Address: https://raychowdhury.github.io/oathsteps/privacy.html and `terms.html`.
- They show **Draft** until a lawyer has reviewed them and you set `LEGAL_REVIEWED_ON`.
- Operator details come from repository variables: Settings, Secrets and variables, Actions, Variables. Set `LEGAL_ENTITY`, `LEGAL_CONTACT_EMAIL`, `LEGAL_CONTACT_URL`, `LEGAL_JURISDICTION`, `LEGAL_REVIEWED_ON` and `MAIL_PROVIDER` to the same values as in the server's `.env`, then re-run the workflow (Actions, Legal pages, Run workflow). Until you do, the pages name the project and point to GitHub issues for contact, and do not publish your email.
- GitHub Pages is free for public repositories. It would need a paid plan if the repository were made private.

## After the first start

```bash
curl -fsS https://study.example.org/api/health      # {"status":"ok"}
docker compose -f docker-compose.yml -f deploy/docker-compose.cloudflare.yml run --rm --no-deps migrate pnpm release:check
```

(Use `deploy/docker-compose.prod.yml` instead of the Cloudflare file on Path B.) The second command runs the launch check inside the build image with the same `.env`. It lists every gate still open: mail, public address, operator details, the lawyer review of the Privacy notice and Terms, and the expert review of each content scope. It exits with an error until all are closed. That is expected on day one.

Then in a browser: create an account and confirm the email arrives; use "Forgot your password?"; open `/privacy` and `/terms`.

The server refuses to start in production with a missing or weak secret, a non-HTTPS public address, or a mail provider without its key. The reason is in `docker compose logs app`.

## Backups

The database is one SQLite file in the `oathsteps-data` volume. `scripts/backup.sh` copies it while the app keeps running (SQLite's online backup), checks that the copy opens and passes an integrity check, compresses it into `./backups`, and deletes local copies older than 14 days. Run it from the repository folder:

```bash
bash scripts/backup.sh
```

Schedule it daily with cron on the machine (`crontab -e`), adjusting the folder:

```bash
15 3 * * * cd /srv/oathsteps && bash scripts/backup.sh >> backups/backup.log 2>&1
```

A backup that lives only on the same disk is not a backup. Install `rclone`, configure any remote with `rclone config` (Cloudflare R2, Backblaze B2, Google Drive and others work), and set `BACKUP_RCLONE_REMOTE`, for example `r2:oathsteps-backups`, in `.env`. Every backup is then copied off the machine too. `BACKUP_DIR` and `BACKUP_KEEP_DAYS` change the folder and the retention.

Backups contain learner data. `./backups` is excluded from git and from the Docker build. Account deletion removes live data at once; backups keep it until they rotate out, which the Privacy notice says.

**Restore:**

```bash
bash scripts/restore.sh backups/oathsteps-2026-10-05T031500Z.db.gz
```

It asks for confirmation, stops the app for a moment, keeps the current database in the volume as `pre-restore-<time>.db` so the restore can be undone, swaps in the backup, and starts the app again. This round trip (backup, new data, restore, sign-in, new writes) was tested against a running container.

## Updating and rolling back

```bash
git pull
docker compose -f docker-compose.yml -f deploy/docker-compose.cloudflare.yml up -d --build
```

Migrations run automatically before the app starts. To roll back, `git checkout <previous commit>` and run the same command. Migrations in this project only add tables and columns, so the previous version keeps working against a newer database. Take a backup before any update.

## Monitoring

Point a free uptime monitor at `https://study.example.org/api/health` and alert on failure. The app logs errors only, never learner data. Docker keeps the last 50 MB of logs per container (`docker compose logs`).

## Contact address without publishing your email

Cloudflare Email Routing (free, once the domain is on Cloudflare) forwards `privacy@your-domain` to your own inbox. Use that address as `LEGAL_CONTACT_EMAIL`.

## Not covered

PostgreSQL and more than one app instance (see OPERATIONS.md), and any integration that is still a disabled placeholder (speech scoring, USCIS case status, payments, push).
