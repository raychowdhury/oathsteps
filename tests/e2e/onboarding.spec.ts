import { expect, test } from "@playwright/test";
import { answerCard, setupProfile } from "./helpers";

test.describe("onboarding and first practice", () => {
  test("welcome → setup explains the path at the filing boundary → Today → persisted practice", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Practice. Prepare. Track your journey." })).toBeVisible();
    await page.getByRole("link", { name: "Get started" }).click();
    await expect(page).toHaveURL(/\/setup$/);

    const explanation = page.getByTestId("path-explanation");
    await expect(explanation).toContainText("Test version not set".length ? /filed/i : "");
    await page.getByLabel("Filing date").fill("2025-10-19");
    await expect(explanation).toContainText("2008 civics test");
    await page.getByLabel("Filing date").fill("2025-10-20");
    await expect(explanation).toContainText("2025 civics test");

    await page.getByRole("button", { name: "Start studying" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("2025 civics test · 128 questions")).toBeVisible();
    await expect(page.getByTestId("new-count")).toHaveText("5");
    await expect(page.getByTestId("due-count")).toHaveText("0");
    // No interview date entered → no countdown is fabricated.
    await expect(page.getByText(/to your interview/)).toHaveCount(0);

    await page.getByTestId("start-today").click();
    await expect(page.getByRole("heading", { name: "Today’s cards" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show answer" })).toBeVisible();
    // Answer is hidden until asked for (recall-first).
    await expect(page.getByText("Accepted answer")).toHaveCount(0);
    await answerCard(page, "Got it");
    await answerCard(page, "Unsure");
    await page.getByRole("button", { name: "Finish early" }).click();
    await expect(page.getByRole("heading", { name: "Session complete" })).toBeVisible();
    await expect(page.getByText("recalled without help")).toBeVisible();

    await page.reload();
    await page.goto("/");
    await expect(page.getByText("2 attempts recorded")).toBeVisible();
    // The uncertain answer is due again tomorrow, not today; only unseen questions are new.
    await expect(page.getByTestId("new-count")).toHaveText("5");
  });

  test("unknown filing date is never defaulted; provisional choice is labeled", async ({ page }) => {
    await page.goto("/setup");
    await page.getByRole("button", { name: "Start studying" }).click();
    await expect(page.getByRole("alert")).toContainText(/filing date/i);
    await page.getByLabel(/I’m not sure/).check();
    await page.getByRole("button", { name: "Start studying" }).click();
    await expect(page.getByRole("alert")).toContainText(/Choose which test/);
    await page.getByLabel("Which test do you want to study for now?").selectOption("2008");
    await expect(page.getByTestId("path-explanation")).toContainText("Provisional".length ? /chose the 2008 test/ : "");
    await page.getByRole("button", { name: "Start studying" }).click();
    await expect(page.getByText("2008 civics test · 100 questions · provisional")).toBeVisible();
  });

  test("65/20 restricts practice to the designated questions and shows a countdown only from an entered date", async ({ page }) => {
    const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    await setupProfile(page, { filingDate: "2026-02-01", special: true, interviewDate: soon });
    await expect(page.getByText("65/20 (20 questions)")).toBeVisible();
    await expect(page.getByText(/days? to your interview/)).toBeVisible();
    await page.getByTestId("start-today").click();
    await expect(page.getByText("· 65/20").first()).toBeVisible();
  });
});
