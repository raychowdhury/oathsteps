import { expect, test } from "@playwright/test";
import { answerCard, errorLine, setupProfile, startToday } from "./helpers";

test.describe.configure({ timeout: 120_000 });

test.describe("welcome, setup and first practice", () => {
  test("setup routes the test at the filing boundary, validates dates, and Today shows the plan", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "OathSteps" })).toBeVisible();
    await expect(page.getByText("Practice. Prepare. Track your journey.")).toBeVisible();
    await expect(page.getByText("We never ask for your SSN, A-Number, ID or USCIS password.")).toBeVisible();
    await page.getByTestId("start-setup").click();
    await expect(page.getByText("Set up · step 1 of 5")).toBeVisible();
    await page.getByTestId("setup-next").click();

    // Future date is rejected with the design's wording.
    await page.getByLabel("Filing date").fill("2027-02-14");
    await page.getByTestId("setup-next").click();
    await expect(errorLine(page)).toContainText("That date is in the future. Check the date on your receipt notice.");
    // Boundary: Oct 19 → 2008 test, Oct 20 → 2025 test.
    await page.getByLabel("Filing date").fill("2025-10-19");
    await expect(page.getByTestId("route-card")).toContainText("2008 civics test");
    await expect(page.getByTestId("route-card")).toContainText("Up to 10 asked · 6 correct to pass");
    await page.getByLabel("Filing date").fill("2025-10-20");
    await expect(page.getByTestId("route-card")).toContainText("2025 civics test");
    await expect(page.getByTestId("route-card")).toContainText("Stops at 12 correct or 9 incorrect");
    await page.getByTestId("setup-next").click();

    // Interview date before filing is rejected.
    await page.getByLabel("Interview date (optional)").fill("2025-01-01");
    await page.getByTestId("setup-next").click();
    await expect(errorLine(page)).toContainText("Your interview can’t be before your filing date (Oct 20, 2025).");
    await page.getByLabel("Interview date (optional)").fill("");
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page.getByRole("heading", { name: "Exceptions and special consideration" })).toBeVisible();
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page.getByRole("heading", { name: "Check your study path" })).toBeVisible();
    await expect(page.getByText("2025 civics test · filed Oct 20, 2025")).toBeVisible();
    await page.getByTestId("setup-next").click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("You’re set. Your study path is saved on this device.")).toBeVisible();
    await expect(page.getByTestId("path-tag")).toHaveText("2025 civics test");
    await expect(page.getByTestId("plan-fresh")).toContainText("Learn 5 new questions");
    await expect(page.getByTestId("plan-english")).toContainText("Reading: one sentence");
    await expect(page.getByTestId("countdown")).toHaveCount(0);
    await expect(page.getByText("Readiness details")).toBeVisible();

    // Recall-first session: answer is hidden until revealed; grades and requeue work.
    await startToday(page).click();
    await expect(page.getByTestId("q-position")).toHaveText("Question 1 of 5");
    await expect(page.getByTestId("answer-card")).toHaveCount(0);
    await answerCard(page, "got");
    await answerCard(page, "again");
    await expect(page.getByTestId("q-position")).toHaveText("Question 3 of 6");
    await answerCard(page, "unsure");
    await answerCard(page, "got");
    await answerCard(page, "got");
    await answerCard(page, "got"); // the requeued question
    await expect(page.getByTestId("session-done")).toBeVisible();
    await expect(page.getByTestId("count-got")).toHaveText("4");
    await expect(page.getByTestId("count-again")).toHaveText("1");
    await expect(page.getByTestId("count-unsure")).toHaveText("1");
    await expect(page.getByText("Reading: one sentence")).toBeVisible();

    await page.goto("/");
    await expect(page.getByTestId("plan-review")).toContainText("Done:");
    await expect(page.getByText("Review 1 answer to try again")).toBeVisible();
    await expect(page.getByText("Seen 5 of 128")).toBeVisible();
  });

  test("'I'm not sure' keeps the version unset and Today says so", async ({ page }) => {
    await setupProfile(page, { unsure: true });
    await expect(page.getByTestId("path-tag")).toHaveText("Test version not set");
    await expect(page.getByTestId("no-version")).toContainText("Your test version isn’t set");
    await page.goto("/practice");
    await expect(page.getByText("Practicing the 2025 list until you add your filing date")).toBeVisible();
    await expect(page.getByText("Needs your test version")).toBeVisible();
    // Fix it from the Today tag: filing sheet.
    await page.goto("/");
    await page.getByTestId("path-tag").click();
    await page.getByLabel("I’m not sure").uncheck();
    await page.getByLabel("N-400 filing date").fill("2025-11-12");
    await page.getByTestId("save-filing").click();
    await expect(page.getByText("Study path changed to: 2025 civics test.")).toBeVisible();
    await expect(page.getByTestId("path-tag")).toHaveText("2025 civics test");
  });

  test("65/20 and an interview date give a countdown and the 20-question set", async ({ page }) => {
    const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    await setupProfile(page, { filingDate: "2026-02-01", special: true, interviewDate: soon, state: "NY" });
    await expect(page.getByTestId("path-tag")).toHaveText("2025 civics test · 65/20");
    await expect(page.getByTestId("countdown")).toContainText("Interview in 10 days");
    await expect(page.getByTestId("countdown")).toContainText("entered by you");
    await page.goto("/readiness");
    await expect(page.getByTestId("rd-seen")).toContainText("of 20");
  });

  test("the demo learner is labeled and can be cleared", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("load-demo").click();
    await expect(page.getByText("Loaded a returning learner with illustrative, fictional history.")).toBeVisible();
    await expect(page.getByText("Demo", { exact: true })).toBeVisible();
    await expect(page.getByTestId("countdown")).toContainText("Interview in 44 days");
    await expect(page.getByText("Demo history, not real results.")).toBeVisible();
    await page.goto("/readiness");
    await expect(page.getByText("Includes illustrative demo history")).toBeVisible();
    await page.goto("/settings");
    await page.getByRole("button", { name: "Clear demo" }).click();
    await expect(page.getByRole("heading", { name: "OathSteps" })).toBeVisible();
    await expect(page.getByText("Demo", { exact: true })).toHaveCount(0);
  });
});
