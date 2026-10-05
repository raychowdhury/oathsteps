# OathSteps production image. Single instance with SQLite on a persistent volume at /data.
# Build:  docker compose build
# Run:    docker compose up -d   (runs migrations first, then the app)

FROM node:24-alpine AS base
RUN corepack enable && apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# ---- builder: full dependencies, prisma client, production build ----
FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV BUILD_STANDALONE=1 NEXT_TELEMETRY_DISABLED=1 DATABASE_URL=file:/data/oathsteps.db
RUN pnpm db:generate && pnpm content:validate && pnpm build

# ---- migrate: runs `prisma migrate deploy` against the shared volume, then exits ----
FROM builder AS migrate
ENV DATABASE_URL=file:/data/oathsteps.db
CMD ["pnpm", "db:deploy"]

# ---- runner: minimal standalone server ----
FROM node:24-alpine AS runner
RUN apk add --no-cache libc6-compat && addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 DATABASE_URL=file:/data/oathsteps.db MAIL_SINK_DIR=/data/mail
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
RUN mkdir -p /data && chown app:app /data
USER app
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/offline >/dev/null || exit 1
CMD ["node", "server.js"]
