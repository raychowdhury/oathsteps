import { expect, test } from "@playwright/test";
import { answerCard, errorLine, setupProfile } from "./helpers";

test.describe.configure({ timeout: 180_000 });

test.describe("settings, data controls and offline", () => {
  test("appearance, text size, reminders, export, reset and typed delete", async ({ page }) => {
    await setupProfile(page, { filingDate: "2026-01-15" });
    await page.goto("/practice/session?kind=daily");
    await answerCard(page, "got");
    await page.goto("/settings");
    await expect(page.getByTestId("settings-path")).toHaveText("2025 civics test");

    await page.getByLabel("Dark").check();
    await expect(page.locator("#o-app")).toHaveClass(/o-dark/);
    await page.getByLabel("Light").check();
    await expect(page.locator("#o-app")).not.toHaveClass(/o-dark/);
    await page.getByLabel("Larger").check();
    await expect(page.locator("html")).toHaveAttribute("data-text-size", "xlarge");
    await page.getByLabel("Default").check();

    await page.getByLabel("Quiet until").selectOption("21");
    await expect(errorLine(page)).toContainText("Start and end can’t be the same time.");
    await page.getByLabel("Quiet until").selectOption("8");
    await expect(page.getByText("2 study reminders on")).toBeVisible();

    // Export
    await page.getByTestId("export-json").click();
    const dl = page.waitForEvent("download");
    await page.getByTestId("confirm-export").click();
    const json = JSON.parse(await (await (await dl).createReadStream()).toArray().then((b) => Buffer.concat(b).toString()));
    expect(json.attempts).toHaveLength(1);
    expect(json.attempts[0]).toMatchObject({ method: "self-unprompted", prompted: false, packVersion: expect.stringMatching(/^2025\./) });
    expect(json.profile.filingDate).toBe("2026-01-15");
    expect(json.journey).toBeTruthy();
    expect(JSON.stringify(json)).not.toMatch(/ssn|a-number|passport/i);

    // Reset keeps the journey and settings.
    await page.getByTestId("reset-practice").click();
    await page.getByTestId("confirm-reset").click();
    await expect(page.getByText("Practice progress reset.")).toBeVisible();
    await page.goto("/");
    await expect(page.getByText("Seen 1 of 128")).toHaveCount(0);
    await expect(page.getByTestId("path-tag")).toHaveText("2025 civics test");

    // Delete requires typing DELETE.
    await page.goto("/settings");
    await page.getByTestId("delete-all").click();
    await page.getByLabel("Type DELETE to confirm").fill("delete");
    await page.getByTestId("confirm-delete").click();
    await expect(errorLine(page)).toContainText("Type DELETE in capital letters to continue.");
    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await page.getByTestId("confirm-delete").click();
    await expect(page.getByTestId("start-setup")).toBeVisible();
  });

  test("downloaded content keeps practice working after a cold offline reload", async ({ page, context }) => {
    await setupProfile(page, { filingDate: "2026-01-15" });
    await page.goto("/settings");
    await page.waitForFunction(() => navigator.serviceWorker?.getRegistration().then((r) => Boolean(r?.active)), null, { timeout: 20_000 });
    await page.reload();
    await page.getByTestId("download-offline").click();
    await expect(page.getByText(/Saved \d+ files for offline use/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Downloaded", { exact: true })).toBeVisible();

    await context.setOffline(true);
    await page.goto("/practice/session?kind=daily", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("You’re offline")).toBeVisible({ timeout: 20_000 });
    await answerCard(page, "got");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Seen 1 of 128")).toBeVisible();
    await context.setOffline(false);
    await page.reload();
    await expect(page.getByText("Seen 1 of 128")).toBeVisible();
  });
});
