import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * Browser tests run against the production build (service worker, headers, real auth handler).
 * `pnpm build` must have run first; `pnpm verify` does this. Each test gets an isolated browser
 * context, so guest data (IndexedDB) starts empty every time.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure", video: "off" },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } }, testMatch: /(onboarding|a11y)\.spec\.ts/ },
  ],
  webServer: {
    command: `pnpm db:deploy && pnpm start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: "file:./data/e2e.db",
      MAIL_SINK_DIR: "./data/e2e-mail",
      // The suite signs up many accounts from one address in seconds. The limiter is asserted in scripts/docker-smoke.sh.
      AUTH_RATE_LIMIT: "off",
      BETTER_AUTH_URL: baseURL,
      NEXT_PUBLIC_APP_URL: baseURL,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "e2e-only-secret-not-for-production-0123456789",
      NODE_ENV: "production",
    },
  },
});
