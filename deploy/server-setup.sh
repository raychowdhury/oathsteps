#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 server for OathSteps behind a Cloudflare Tunnel (docs/DEPLOY.md, Path A).
# Run as root:  bash server-setup.sh
# Safe to run again. It never overwrites an existing .env.
set -euo pipefail
APP_DIR=/srv/oathsteps
REPO=https://github.com/raychowdhury/oathsteps.git

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq
# Docker from Ubuntu's own archive: no third-party install script.
apt-get install -yq docker.io docker-compose-v2 git ufw unattended-upgrades sqlite3
systemctl enable --now docker
dpkg-reconfigure -f noninteractive unattended-upgrades

# Building the Next.js image needs more memory than the smallest servers have.
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# The tunnel is outbound only, so the only open inbound port is SSH.
ufw allow OpenSSH >/dev/null
ufw --force enable >/dev/null

# Key-only SSH, but only once a key is installed, so this can never lock you out.
if [ -s /root/.ssh/authorized_keys ]; then
  printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin prohibit-password\n' > /etc/ssh/sshd_config.d/10-oathsteps.conf
  systemctl reload ssh
fi

if [ -d "$APP_DIR/.git" ]; then git -C "$APP_DIR" pull --ff-only; else git clone "$REPO" "$APP_DIR"; fi
cd "$APP_DIR"

if [ ! -f .env ]; then
  umask 077
  cat > .env <<ENV
APP_URL=https://oathsteps.com
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
CLOUDFLARE_TUNNEL_TOKEN=
MAIL_PROVIDER=brevo
BREVO_API_KEY=
MAIL_FROM=
LEGAL_ENTITY=
LEGAL_CONTACT_EMAIL=
LEGAL_CONTACT_URL=https://github.com/raychowdhury/oathsteps/issues
LEGAL_JURISDICTION=
BACKUP_RCLONE_REMOTE=
ENV
  echo "Created $APP_DIR/.env with a new secret. Fill in CLOUDFLARE_TUNNEL_TOKEN, BREVO_API_KEY and MAIL_FROM."
fi

# Nightly backup at 03:15 server time (scripts/backup.sh keeps 14 days).
( crontab -l 2>/dev/null | grep -v 'scripts/backup.sh'; echo "15 3 * * * cd $APP_DIR && bash scripts/backup.sh >> backups/backup.log 2>&1" ) | crontab -
mkdir -p backups

echo "Setup done. Start with:"
echo "  cd $APP_DIR && docker compose -f docker-compose.yml -f deploy/docker-compose.cloudflare.yml up -d --build"
