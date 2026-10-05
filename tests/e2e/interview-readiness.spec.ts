import { expect, test } from "@playwright/test";
import { answerCard, setupProfile } from "./helpers";

test.describe("interview English and readiness", () => {
  test("each English task kind records a self-reported result; readiness explains itself", async ({ page }) => {
    await setupProfile(page, { filingDate: "2026-01-15" });
    await page.goto("/interview");
    await expect(page.getByRole("heading", { name: "Interview English" })).toBeVisible();

    // Reading
    await page.getByRole("button", { name: "Yes", exact: true }).click();
    await expect(page.getByText("Saved as self-reported")).toBeVisible();
    // Writing (dictation)
    await page.getByRole("button", { name: "Writing" }).click();
    await page.getByLabel("Write what you heard").fill("Washington was the first President.");
    await page.getByRole("button", { name: "Check my sentence" }).click();
    await expect(page.getByText("matches word for word")).toBeVisible();
    await page.getByRole("button", { name: "Yes", exact: true }).click();
    // Instructions
    await page.getByRole("button", { name: "Instructions" }).click();
    await page.getByRole("button", { name: "Show what it means" }).click();
    await page.getByRole("button", { name: "Partly" }).click();
    // N-400 words
    await page.getByRole("button", { name: "N-400 words" }).click();
    await page.getByRole("button", { name: "Show meaning" }).click();
    await page.getByRole("button", { name: "Yes", exact: true }).click();
    // Conversation: tip only, never an invented answer.
    await page.getByRole("button", { name: "Conversation" }).click();
    await expect(page.getByText("never writes answers for you")).toBeVisible();
    await page.getByRole("button", { name: "Show a tip" }).click();
    await page.getByRole("button", { name: "Not yet" }).click();

    // Readiness: empty state until 10 attempts, then definitions with numerators/denominators.
    await page.goto("/readiness");
    await expect(page.getByText("Not enough history yet")).toBeVisible();
    await page.goto("/practice/session?mode=topic&topic=Principles%20of%20American%20Government");
    for (let i = 0; i < 10; i++) await answerCard(page, "Got it");
    await page.goto("/readiness");
    await expect(page.getByRole("heading", { name: "Coverage" })).toBeVisible();
    await expect(page.getByText("Questions practiced at least once")).toBeVisible();
    await expect(page.getByText("Method: self-assessed, unprompted. Delay: at least 24 hours.")).toBeVisible();
    await expect(page.getByText("No mock tests yet.")).toBeVisible();
    await expect(page.locator("li", { hasText: "reading" })).toContainText("1 yes of 1");
    await expect(page.locator("li", { hasText: "conversation" })).toContainText("0 yes of 1");
    // No percentage or probability anywhere on the page.
    await expect(page.getByText(/\d+%/)).toHaveCount(0);
    await expect(page.getByText(/probab/i)).toHaveCount(1); // only the disclaimer mentions it
  });
});
