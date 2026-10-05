import { expect, test } from "@playwright/test";
import { answerCard, setupProfile } from "./helpers";

test.describe("practice modes", () => {
  test("topics, bookmarks, multiple choice and the dynamic-answer flow", async ({ page }) => {
    await setupProfile(page, { filingDate: "2026-01-15" });
    await page.goto("/practice/topics");
    await expect(page.getByRole("heading", { name: "Browse by topic" })).toBeVisible();
    await page.getByRole("link", { name: /System of Government/ }).click();
    await expect(page.getByRole("heading", { name: "System of Government" })).toBeVisible();

    // Bookmark the first card, then it shows up in the bookmarks session.
    await page.getByRole("button", { name: "Bookmark this question" }).click();
    await expect(page.getByRole("button", { name: "Remove bookmark" })).toBeVisible();
    await page.goto("/practice/session?mode=bookmarks");
    await expect(page.getByRole("heading", { name: "Bookmarked questions" })).toBeVisible();
    await expect(page.getByText("1 of 1")).toBeVisible();

    // Multiple choice records recognition, not recall.
    await page.goto("/practice/session?mode=mc");
    await expect(page.getByRole("heading", { name: "Multiple-choice check" })).toBeVisible();
    await expect(page.getByText("counts as recognition, not recall")).toBeVisible();
    const option = page.getByRole("group").getByRole("button").first();
    await option.click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Finish early" }).click();
    await expect(page.getByText("recognized")).toBeVisible();

    // Dynamic question: lookup link, confirm form, unscored until confirmed.
    await page.goto("/practice/session?mode=topic&topic=System%20of%20Government");
    // Walk until a "This answer changes" card appears (Q23 senators is in this subsection).
    for (let i = 0; i < 20; i++) {
      if (await page.getByText("This answer changes").isVisible()) break;
      await answerCard(page, "Got it");
    }
    await expect(page.getByText("This answer changes")).toBeVisible();
    await expect(page.getByRole("link", { name: /senate\.gov|house\.gov|usa\.gov|USCIS test updates/ })).toBeVisible();
    await page.getByRole("button", { name: "Record my answer" }).click();
    await page.getByLabel("Answer you confirmed").fill("Example Senator");
    await page.getByLabel(/Your state/).fill("Example State");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Your confirmed answer")).toBeVisible();
    await expect(page.getByText("Example Senator")).toBeVisible();
  });

  test("hinted recall is recorded as hinted and reported separately", async ({ page }) => {
    await setupProfile(page, { filingDate: "2026-01-15" });
    await page.goto("/practice/session?mode=today");
    await page.getByRole("button", { name: "Need a hint" }).click();
    await expect(page.getByText(/^Hint:/)).toBeVisible();
    await answerCard(page, "Got it");
    await page.getByRole("button", { name: "Finish early" }).click();
    await expect(page.locator("li", { hasText: "got with a hint" })).toContainText("1");
    await expect(page.locator("li", { hasText: "recalled without help" })).toContainText("0");
  });
});
