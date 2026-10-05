import { expect, test } from "@playwright/test";
import { answerCard, setupProfile } from "./helpers";

test.describe("mock test", () => {
  test("2025 path stops at 12 correct and reports what was attempted", async ({ page }) => {
    await setupProfile(page, { filingDate: "2026-01-15" });
    await page.goto("/practice/mock");
    await expect(page.getByText("Up to 20 questions from the 128-question 2025 bank. 12 correct passes")).toBeVisible();
    await page.getByTestId("start-mock").click();
    for (let i = 0; i < 12; i++) {
      await expect(page.getByText(`question ${i + 1} of up to 20`)).toBeVisible();
      await answerCard(page, "Got it");
    }
    const results = page.getByTestId("mock-results");
    await expect(results.getByRole("heading", { name: "You reached the passing mark" })).toBeVisible();
    await expect(results).toContainText("12 questions attempted of up to 20. 12 correct, 0 incorrect.");
    await expect(results).toContainText("Self-assessed");
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("12/12 correct")).toBeVisible();
  });

  test("2008 path stops at 5 incorrect, pause/resume keeps answers, and 'unsure' counts as not correct", async ({ page }) => {
    await setupProfile(page, { filingDate: "2025-10-19" });
    await page.goto("/practice/mock");
    await expect(page.getByText("Up to 10 questions from the 100-question 2008 bank. 6 correct passes")).toBeVisible();
    await page.getByTestId("start-mock").click();
    await answerCard(page, "Got it");
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByRole("heading", { name: "Mock paused" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Mock paused" })).toBeVisible();
    await page.getByRole("button", { name: "Resume" }).click();
    await expect(page.getByText("1 correct")).toBeVisible();
    for (let i = 0; i < 4; i++) await answerCard(page, "Missed");
    await answerCard(page, "Unsure");
    const results = page.getByTestId("mock-results");
    await expect(results.getByRole("heading", { name: "Not this time" })).toBeVisible();
    await expect(results).toContainText("6 questions attempted of up to 10. 1 correct, 4 incorrect, 1 unsure (counted as not correct)");
    await expect(results.getByRole("heading", { name: "Review what you missed" })).toBeVisible();
  });
});
