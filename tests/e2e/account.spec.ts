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
    await page.goto("/practice/session?mode=today");
    await answerCard(page, "Got it");
    await answerCard(page, "Got it");

    await signUp(page, email);
    await expect(page.getByText("Move your guest progress into this account?")).toBeVisible();
    await expect(page.getByText("2 attempts and your settings")).toBeVisible();
    await page.getByTestId("migrate").click();
    await expect(page.getByText(/Synced \d+ changes/)).toBeVisible();

    // Second device: sign in with an empty store → progress is pulled.
    const { ctx: ctx2, page: page2 } = await freshPage(browser);
    await signIn(page2, email);
    await page2.getByTestId("migrate").click();
    await expect(page2.getByText(/merged \d+ records/)).toBeVisible();
    await page2.goto("/");
    await expect(page2.getByText("2 attempts recorded")).toBeVisible();
    await expect(page2.getByText("2025 civics test · 128 questions")).toBeVisible();

    // Another user cannot see the first user's data (server-side isolation).
    const { ctx: ctx3, page: page3 } = await freshPage(browser);
    const other = uniqueEmail("two");
    await signUp(page3, other);
    const snap = await page3.request.get("/api/sync");
    expect(snap.ok()).toBeTruthy();
    expect((await snap.json()).events).toEqual([]);
    // Unauthenticated access is refused.
    const anon = await request.get("/api/sync");
    expect(anon.status()).toBe(401);
    await ctx3.close();

    // Sign-out clears this device's private cache.
    await page2.goto("/account");
    await page2.getByTestId("sign-out").click();
    await expect(page2).toHaveURL(/\/$/);
    await expect(page2.getByRole("heading", { name: "Practice. Prepare. Track your journey." })).toBeVisible();
    await ctx2.close();

    // Deleting the account removes synced records; signing in again is impossible.
    await page.goto("/account");
    await page.getByTestId("delete-account").click();
    await page.getByTestId("confirm-delete-account").click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Practice. Prepare. Track your journey." })).toBeVisible();
    await page.goto("/account");
    await page.getByRole("tab", { name: "Sign in" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("correct-horse-battery-10");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
  });
});
