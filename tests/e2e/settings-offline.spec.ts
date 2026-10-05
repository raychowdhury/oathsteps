import { expect, test } from "@playwright/test";
import { answerCard, setupProfile } from "./helpers";

test.describe("settings, export, reset, deletion and offline", () => {
  test("export contains attempts; reset keeps setup; delete returns to welcome", async ({ page }) => {
    await setupProfile(page, { filingDate: "2026-01-15" });
    await page.goto("/practice/session?mode=today");
    await answerCard(page, "Got it");
    await page.goto("/settings");
    const dl = page.waitForEvent("download");
    await page.getByTestId("export-json").click();
    const file = await dl;
    const json = JSON.parse(await (await file.createReadStream()).toArray().then((b) => Buffer.concat(b).toString()));
    expect(json.attempts).toHaveLength(1);
    expect(json.attempts[0]).toMatchObject({ method: "self-unprompted", prompted: false, packVersion: expect.stringMatching(/^2025\./) });
    expect(json.profile.filingDate).toBe("2026-01-15");
    expect(JSON.stringify(json)).not.toMatch(/ssn|a-number|passport/i);

    await page.getByRole("button", { name: "Reset learning data" }).click();
    await page.getByRole("button", { name: "Yes, reset" }).click();
    await expect(page.getByText("Learning data cleared")).toBeVisible();
    await page.goto("/");
    await expect(page.getByText("0 attempts recorded")).toBeVisible();
    await expect(page.getByText("2025 civics test · 128 questions")).toBeVisible();

    await page.goto("/settings");
    await page.getByTestId("delete-all").click();
    await page.getByTestId("confirm-delete").click();
    await expect(page.getByRole("heading", { name: "Practice. Prepare. Track your journey." })).toBeVisible();
  });

  test("downloaded content keeps practice working after a cold offline reload", async ({ page, context }) => {
    await setupProfile(page, { filingDate: "2026-01-15" });
    await page.goto("/settings");
    // Wait for the service worker to control the page before asking it to download.
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null || navigator.serviceWorker?.getRegistration().then((r) => Boolean(r?.active)), null, { timeout: 20_000 });
    await page.reload();
    await page.getByTestId("download-offline").click();
    await expect(page.getByText(/Saved \d+ files for offline use/)).toBeVisible({ timeout: 60_000 });

    await context.setOffline(true);
    await page.goto("/practice/session?mode=today", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Show answer" })).toBeVisible({ timeout: 20_000 });
    await answerCard(page, "Got it");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("1 attempt recorded")).toBeVisible();
    await context.setOffline(false);
    await page.reload();
    await expect(page.getByText("1 attempt recorded")).toBeVisible();
  });
});
