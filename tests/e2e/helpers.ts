import { expect, type Page } from "@playwright/test";

/** Complete Setup as a guest with a given filing date (or "unknown" + provisional bank). */
export async function setupProfile(page: Page, opts: { filingDate?: string; unknownBank?: "2025" | "2008"; special?: boolean; interviewDate?: string } = {}) {
  await page.goto("/setup");
  if (opts.unknownBank) {
    await page.getByLabel(/I’m not sure/).check();
    await page.getByLabel("Which test do you want to study for now?").selectOption(opts.unknownBank);
  } else {
    await page.getByLabel("Filing date").fill(opts.filingDate ?? "2026-01-15");
  }
  if (opts.special) await page.getByLabel(/I was 65 or older/).check();
  if (opts.interviewDate) await page.getByLabel("Interview date").fill(opts.interviewDate);
  await page.getByRole("button", { name: "Start studying" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("start-today")).toBeVisible();
}

/** Answer the current recall card with a given self-assessment. */
export async function answerCard(page: Page, outcome: "Got it" | "Unsure" | "Missed") {
  await page.getByRole("button", { name: "Show answer" }).click();
  await page.getByRole("button", { name: outcome }).click();
}

export function uniqueEmail(prefix = "learner") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

export async function signUp(page: Page, email: string, password = "correct-horse-battery-10") {
  await page.goto("/account");
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(`Signed in as`)).toBeVisible();
}

export async function signIn(page: Page, email: string, password = "correct-horse-battery-10") {
  await page.goto("/account");
  await page.getByRole("tab", { name: "Sign in" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(`Signed in as`)).toBeVisible();
}
