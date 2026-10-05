import { expect, test } from "@playwright/test";
import { answerCard, setupProfile } from "./helpers";

test.describe.configure({ timeout: 120_000 });

test.describe("interview practice and readiness", () => {
  test("reading, writing with word diff, instructions, N-400, voice fallbacks; readiness explains itself", async ({ page }) => {
    await setupProfile(page, { filingDate: "2026-01-15" });
    await page.goto("/interview");
    await expect(page.getByRole("heading", { name: "Interview practice" })).toBeVisible();
    await expect(page.getByText("Use your own true answers. We never suggest them.")).toBeVisible();

    // Reading: three tries, then out.
    await page.getByRole("link", { name: /^Reading/ }).click();
    await expect(page.getByText("Attempt 1 of 3 · sentence 1")).toBeVisible();
    await page.getByTestId("read-trouble").click();
    await page.getByTestId("read-trouble").click();
    await expect(page.getByText("Attempt 3 of 3")).toBeVisible();
    await page.getByTestId("read-trouble").click();
    await expect(page.getByText("That’s three tries")).toBeVisible();
    await page.getByRole("button", { name: "Another sentence" }).click();
    await page.getByTestId("read-clear").click();
    await expect(page.getByText("You read it clearly")).toBeVisible();
    await expect(page.getByText("Try 1: clear")).toBeVisible();

    // Writing: a one-word difference is underlined; retry; then match.
    await page.goto("/interview/writing");
    await page.getByTestId("write-check").click();
    await expect(page.getByText("Write the sentence first, then check.")).toBeVisible();
    await page.getByLabel("Write the sentence").fill("Washington was the frist president");
    await page.getByTestId("write-check").click();
    await expect(page.getByTestId("write-result")).toContainText("1 word different");
    await expect(page.locator(".o-word-diff")).toHaveText("first");
    await page.getByTestId("write-retry").click();
    await expect(page.getByText("Attempt 2 of 3")).toBeVisible();
    await page.getByLabel("Write the sentence").fill("Washington was the first President.");
    await page.getByTestId("write-check").click();
    await expect(page.getByTestId("write-result")).toContainText("Matches the sentence");
    await expect(page.getByRole("link", { name: "Done" })).toBeVisible();

    // Instructions and N-400 conversation.
    await page.goto("/interview/instructions");
    await expect(page.getByText("“Please raise your right hand.”")).toBeVisible();
    await page.goto("/interview/n400");
    await expect(page.getByText("Use your own true information")).toBeVisible();
    await expect(page.getByTestId("convo-prompt")).toContainText("Tell me about your current job.");
    await page.getByTestId("convo-next").click();
    await expect(page.getByTestId("convo-prompt")).toContainText("How long have you lived at your current address?");

    // Voice: typed and self-check paths work without a microphone.
    await page.goto("/interview/voice");
    await expect(page.getByText("Experimental")).toBeVisible();
    await page.getByTestId("voice-type").click();
    await page.getByLabel("Type your answer").fill("nonsense answer");
    await page.getByTestId("voice-check-typed").click();
    await expect(page.getByText("Doesn’t match exactly. Compare below.")).toBeVisible();
    await page.getByTestId("voice-got").click();
    await expect(page.getByText("Saved as “I got it”. Next question.")).toBeVisible();
    await expect(page.getByText("Question 2 of 5")).toBeVisible();
    await page.getByTestId("voice-self").click();
    await page.getByTestId("voice-self-reveal").click();
    await expect(page.getByText(/^Accepted answer/)).toBeVisible();

    // Readiness: counts with denominators, no percentages.
    await page.goto("/readiness");
    await expect(page.getByText("What you’ve practiced. Not a prediction.")).toBeVisible();
    await expect(page.getByTestId("rd-seen")).toContainText("1 of 128");
    await expect(page.getByTestId("rd-reading")).toContainText("Read clearly (your own check)");
    await expect(page.getByTestId("rd-writing")).toContainText("Matched the sentence");
    await expect(page.getByText("No mocks yet.")).toBeVisible();
    await expect(page.getByText(/\d+%/)).toHaveCount(0);

    // Today's english task is done; the plan reflects it.
    await page.goto("/");
    await expect(page.getByTestId("plan-english")).toContainText("Done:");
  });

  test("recall cards feed the 'try again' list", async ({ page }) => {
    await setupProfile(page, { filingDate: "2026-01-15" });
    await page.goto("/practice/session?kind=topic&topic=Principles%20of%20American%20Government");
    for (let i = 0; i < 3; i++) await answerCard(page, "got");
    await answerCard(page, "unsure");
    await page.getByRole("button", { name: "End session" }).click();
    await page.getByTestId("end-session").click();
    await page.goto("/readiness");
    await expect(page.getByTestId("rd-seen")).toContainText("4 of 128");
    await expect(page.getByTestId("rd-unsure")).toHaveText("1");
    await page.getByRole("link", { name: "Review these now" }).click();
    await expect(page.getByTestId("q-position")).toHaveText("Question 1 of 1");
  });
});
