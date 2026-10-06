import { expect, type Page } from "@playwright/test";

/** Complete the five-step Setup as a guest. */
export async function setupProfile(page: Page, opts: { filingDate?: string; unsure?: boolean; special?: boolean; interviewDate?: string; state?: string } = {}) {
  await page.goto("/setup");
  await expect(page.getByRole("heading", { name: "Which language helps you study?" })).toBeVisible();
  await page.getByTestId("setup-next").click();
  await expect(page.getByRole("heading", { name: "When did you file Form N-400?" })).toBeVisible();
  if (opts.unsure) await page.getByLabel("I’m not sure").check();
  else await page.getByLabel("Filing date").fill(opts.filingDate ?? "2026-01-15");
  await page.getByTestId("setup-next").click();
  await expect(page.getByRole("heading", { name: "Where you live and your interview" })).toBeVisible();
  if (opts.state) await page.getByLabel("State or territory (optional)").selectOption(opts.state);
  if (opts.interviewDate) await page.getByLabel("Interview date (optional)").fill(opts.interviewDate);
  await page.getByTestId("setup-next").click();
  await expect(page.getByRole("heading", { name: "Exceptions and special consideration" })).toBeVisible();
  if (opts.special) await page.getByLabel("Use the 65/20 format (my choice)").check();
  await page.getByTestId("setup-next").click();
  await expect(page.getByRole("heading", { name: "Check your study path" })).toBeVisible();
  await page.getByTestId("setup-next").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(startToday(page)).toBeVisible();
}

/** The design renders the start button twice (desktop column, phone sticky bar); only one is visible. */
export function startToday(page: Page) {
  return page.getByTestId("start-today").filter({ visible: true });
}

/** Inline validation line from the design (never Next's route announcer). */
export function errorLine(page: Page) {
  return page.locator(".o-err");
}

/** Answer the current recall card: reveal, then grade. Waits until the card advances so the write has landed. */
export async function answerCard(page: Page, grade: "got" | "again" | "unsure") {
  await page.getByTestId("reveal").click();
  const button = page.getByTestId(`grade-${grade}`);
  await button.click();
  await expect(button).toBeHidden();
}

/** Mark the current mock question. */
export async function markMock(page: Page, outcome: "correct" | "incorrect" | "unsure") {
  await page.getByTestId("mock-reveal").click();
  const button = page.getByTestId(`mock-${outcome}`);
  await button.click();
  await expect(button).toBeHidden();
}

/** Today plus `days` as YYYY-MM-DD in local time, the way the app computes "today". A UTC date is a day ahead on US evenings. */
export function localDay(days = 0) {
  const t = new Date();
  t.setDate(t.getDate() + days);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export function uniqueEmail(prefix = "learner") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

export async function signUp(page: Page, email: string, password = "correct-horse-battery-10") {
  await page.goto("/account");
  await page.getByRole("radio", { name: "Create account" }).check();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByTestId("account-submit").click();
  await expect(page.getByText("Signed in as")).toBeVisible();
}

export async function signIn(page: Page, email: string, password = "correct-horse-battery-10") {
  await page.goto("/account");
  await page.getByRole("radio", { name: "Sign in" }).check();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByTestId("account-submit").click();
  await expect(page.getByText("Signed in as")).toBeVisible();
}
