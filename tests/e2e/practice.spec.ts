import { expect, test } from "@playwright/test";
import { answerCard, errorLine, setupProfile } from "./helpers";

test.describe("practice library, modes and changing answers", () => {
  test("topics, saving, multiple choice and the source/report sheets", async ({ page }) => {
    await setupProfile(page, { filingDate: "2026-01-15", state: "NY" });
    await page.goto("/practice");
    await expect(page.getByRole("heading", { name: "Practice" })).toBeVisible();
    await expect(page.getByTestId("due-count")).toHaveText("0 due");
    await expect(page.getByText("Official questions:")).toBeVisible();

    // Topic session; save the first question.
    await page.getByRole("link", { name: /System of Government/ }).click();
    await expect(page.getByTestId("q-position")).toContainText("Question 1 of");
    await page.getByTestId("save-question").click();
    await expect(page.getByTestId("save-question")).toHaveText(/Saved/);
    // Sheets on a revealed card.
    await page.getByTestId("reveal").click();
    await page.getByRole("button", { name: "Source and details" }).click();
    await expect(page.getByRole("dialog")).toContainText("Official wording · machine-checked");
    await expect(page.getByRole("dialog").getByRole("link", { name: /USCIS: 2025 civics test/ })).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Report an issue" }).click();
    await page.getByTestId("send-report").click();
    await expect(errorLine(page)).toContainText("Choose one problem so we know what to check.");
    await page.getByLabel("The answer looks wrong").check();
    await page.getByTestId("send-report").click();
    await expect(page.getByText("Report saved")).toBeVisible();
    await page.getByRole("button", { name: "Back to the question" }).click();
    await page.getByTestId("grade-got").click();

    // End session via the back control.
    await page.getByRole("button", { name: "End session" }).click();
    await page.getByTestId("end-session").click();
    await expect(page.getByText("Session ended. Marked answers are saved.")).toBeVisible();
    await expect(page.getByText("1 questions")).toBeVisible(); // Needs work and saved
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();

    // Multiple-choice mode is labeled and does not count as recall.
    await page.getByLabel("Multiple choice").check();
    await expect(page.getByText("Easier. Doesn’t count toward progress.")).toBeVisible();
    await page.getByRole("link", { name: /Principles of American Government/ }).click();
    await expect(page.getByText("Multiple choice · not counted as recall")).toBeVisible();
    await page.getByRole("radio").first().check();
    await expect(page.getByText("Correct answer")).toBeVisible();
    await page.getByTestId("choice-next").click();
    await expect(page.getByTestId("q-position")).toContainText("Question 2 of");
  });

  test("an answer that depends on where you live shows the lookup and a confirm form, and stays out of mocks", async ({ page }) => {
    await setupProfile(page, { filingDate: "2026-01-15", state: "NY" });
    // Q23 (senators) is in System of Government; walk until the varies card appears.
    await page.goto("/practice/session?kind=topic&topic=System%20of%20Government");
    for (let i = 0; i < 25; i++) {
      await page.getByTestId("reveal").click();
      if (await page.getByText("Answer depends on where you live").isVisible()) break;
      const b = page.getByTestId("grade-got");
      await b.click();
      await expect(b).toBeHidden();
    }
    await expect(page.getByText("Answer depends on where you live")).toBeVisible();
    await expect(page.getByRole("link", { name: /senate\.gov/ })).toBeVisible();
    await page.getByTestId("confirm-dynamic").click();
    await page.getByLabel("Answer you confirmed").fill("Example Senator");
    await page.getByLabel("Your state or territory").fill("New York");
    await page.getByTestId("save-dynamic").click();
    await expect(page.getByText("You confirmed: Example Senator (New York")).toBeVisible();
    await page.getByTestId("grade-got").click();
    await page.goto("/practice/mock?kind=full");
    await expect(page.getByText(/questions with changing answers are left out/)).toContainText("7 questions");
  });

  test("hinted recognition is reported separately from recall", async ({ page }) => {
    await setupProfile(page, { filingDate: "2026-01-15" });
    await page.goto("/practice/session?kind=daily");
    await answerCard(page, "got");
    await page.getByRole("button", { name: "End session" }).click();
    await page.getByTestId("end-session").click();
    await page.goto("/readiness");
    await expect(page.getByTestId("rd-seen")).toContainText("1");
    await expect(page.getByTestId("rd-delayed")).toContainText("0");
  });
});
