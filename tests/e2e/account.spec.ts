import { expect, test, type Browser } from "@playwright/test";
import { answerCard, setupProfile, signIn, signUp, uniqueEmail } from "./helpers";

async function freshPage(browser: Browser) {
  const ctx = await browser.newContext();
  return { ctx, page: await ctx.newPage() };
}

test.describe("accounts, migration, sync, isolation, deletion", () => {
  test("guest progress migrates with consent, restores on a new device, is isolated per user, and can be deleted", async ({ page, browser, request }) => {
    const email = uniqueEmail("one");
    await setupProfile(page, { filingDate: "2026-01-15" });
    await page.goto("/practice/session?kind=daily");
    await answerCard(page, "got");
    await answerCard(page, "got");

    await signUp(page, email);
    await expect(page.getByText("Move your guest progress into this account?")).toBeVisible();
    await expect(page.getByText("2 practice records and your settings")).toBeVisible();
    await page.getByTestId("migrate").click();
    await expect(page.getByTestId("account-msg")).toContainText(/Synced \d+ changes/);

    // Second device: sign in with an empty store → progress is pulled.
    const { ctx: ctx2, page: page2 } = await freshPage(browser);
    await signIn(page2, email);
    await page2.getByTestId("migrate").click();
    await expect(page2.getByTestId("account-msg")).toContainText(/merged \d+ records/);
    await page2.goto("/");
    await expect(page2.getByText("Seen 2 of 128")).toBeVisible();
    await expect(page2.getByTestId("path-tag")).toHaveText("2025 civics test");

    // Another user cannot see the first user's data; anonymous access is refused.
    const { ctx: ctx3, page: page3 } = await freshPage(browser);
    await signUp(page3, uniqueEmail("two"));
    const snap = await page3.request.get("/api/sync");
    expect(snap.ok()).toBeTruthy();
    expect((await snap.json()).events).toEqual([]);
    expect((await request.get("/api/sync")).status()).toBe(401);
    await ctx3.close();

    // Sign-out clears this device's private cache.
    await page2.goto("/account");
    await page2.getByTestId("sign-out").click();
    await expect(page2).toHaveURL(/\/$/);
    await expect(page2.getByTestId("start-setup")).toBeVisible();
    await ctx2.close();

    // Deleting the account removes synced records; signing in again fails.
    await page.goto("/account");
    await page.getByTestId("delete-account").click();
    await page.getByTestId("confirm-delete-account").click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("start-setup")).toBeVisible();
    await page.goto("/account");
    await page.getByRole("radio", { name: "Sign in" }).check();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("correct-horse-battery-10");
    await page.getByTestId("account-submit").click();
    await expect(page.getByTestId("account-msg")).toContainText(/invalid|not found|incorrect/i);
  });
});
