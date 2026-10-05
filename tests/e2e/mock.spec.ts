import { expect, test } from "@playwright/test";
import { markMock, setupProfile } from "./helpers";

test.describe("walkthrough and full-format mock", () => {
  test("sample walkthrough stops at 4 correct and reports question by question", async ({ page }) => {
    await setupProfile(page, { filingDate: "2026-01-15" });
    await page.goto("/practice");
    await page.getByTestId("start-walkthrough").click();
    await expect(page.getByText("Practice format · not a full mock")).toBeVisible();
    await expect(page.getByText("Ends early at 4 correct or 3 wrong.")).toBeVisible();
    await page.getByTestId("start-mock").click();
    await expect(page.getByTestId("mock-position")).toHaveText("Sample walkthrough · question 1 of up to 5");
    await markMock(page, "correct");
    await markMock(page, "unsure");
    await expect(page.getByText("Correct 1 · Incorrect 0 · Not sure 1")).toBeVisible();
    await markMock(page, "correct");
    await markMock(page, "correct");
    await markMock(page, "correct");
    const results = page.getByTestId("mock-results");
    await expect(results.getByRole("heading", { name: "Walkthrough results" })).toBeVisible();
    await expect(page.getByTestId("mock-score")).toContainText("4 of 5 correct");
    await expect(results).toContainText("Stopped early after 4 correct, like the real stop rule.");
    await expect(results).toContainText("Practice result only");
    await expect(results.getByText("Not sure", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Review the 1 to work on" }).click();
    await expect(page.getByTestId("q-position")).toHaveText("Question 1 of 1");
  });

  test("full-format 2025 mock uses the real rule, pauses and resumes, and treats unsure as not correct", async ({ page }) => {
    await setupProfile(page, { filingDate: "2026-01-15" });
    await page.goto("/practice/mock?kind=full");
    await expect(page.getByText("Up to 20 asked · 12 correct to pass.")).toBeVisible();
    await page.getByTestId("start-mock").click();
    await expect(page.getByTestId("mock-position")).toHaveText("Full-format mock · question 1 of up to 20");
    await markMock(page, "correct");
    await page.getByRole("button", { name: "Exit walkthrough" }).click();
    await page.getByTestId("pause-mock").click();
    await expect(page.getByText("Full-format mock saved. Resume it from Practice.")).toBeVisible();
    await expect(page.getByText("Mock paused")).toBeVisible();
    await page.getByRole("link", { name: "Resume" }).click();
    await page.getByTestId("resume-mock").click();
    await expect(page.getByText("Correct 1 · Incorrect 0 · Not sure 0")).toBeVisible();
    for (let i = 0; i < 8; i++) await markMock(page, "incorrect");
    await markMock(page, "unsure");
    await expect(page.getByTestId("mock-score")).toContainText("1 of 10 correct");
    await expect(page.getByTestId("mock-results")).toContainText("Stopped early after 9 incorrect");
    await expect(page.getByTestId("mock-results")).toContainText("Passing needs 12 correct.");
  });

  test("2008 path mock stops at 6 correct", async ({ page }) => {
    await setupProfile(page, { filingDate: "2025-10-19" });
    await page.goto("/practice/mock?kind=full");
    await expect(page.getByText("Up to 10 asked · 6 correct to pass.")).toBeVisible();
    await page.getByTestId("start-mock").click();
    for (let i = 0; i < 6; i++) await markMock(page, "correct");
    await expect(page.getByTestId("mock-score")).toContainText("6 of 6 correct");
    await expect(page.getByTestId("mock-results")).toContainText("Reached the passing mark (6 correct).");
  });
});
