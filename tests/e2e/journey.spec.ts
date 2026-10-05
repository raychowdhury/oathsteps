import { expect, test } from "@playwright/test";
import { setupProfile } from "./helpers";

test.describe("journey, guide and reminders", () => {
  test("milestones with reuse, retest and rescheduling; checklist, reminder and .ics export", async ({ page }) => {
    await setupProfile(page, { filingDate: "2026-01-15" });
    await page.goto("/journey");
    await expect(page.getByText("Explore and prepare").first()).toBeVisible();

    // N-400 filed (date prefilled from profile).
    await page.getByTestId("add-milestone").click();
    await expect(page.getByLabel("Date")).toHaveValue("2026-01-15");
    await page.getByTestId("save-milestone").click();
    await expect(page.getByText("N-400 filed")).toBeVisible();
    await expect(page.locator("summary", { hasText: "Receipt and biometrics" })).toContainText("your stage");

    // Biometrics reused: date optional.
    await page.getByTestId("add-milestone").click();
    await page.getByLabel("Milestone").selectOption("biometrics-reused");
    await page.getByTestId("save-milestone").click();
    await expect(page.getByText("Biometrics reused (no appointment)")).toBeVisible();
    await expect(page.locator("summary", { hasText: "Interview preparation" })).toContainText("your stage");

    // Interview scheduled in 3 days → appears as an appointment reminder; then reschedule it.
    const d = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
    await page.getByTestId("add-milestone").click();
    await page.getByLabel("Milestone").selectOption("interview");
    await page.getByLabel(/Scheduled date/).fill(d(3));
    await page.getByTestId("save-milestone").click();
    await expect(page.getByText("Interview", { exact: true })).toBeVisible();
    await expect(page.locator("li", { hasText: "appointments" })).toContainText("Interview");
    await page.getByRole("button", { name: "Edit Interview" }).click();
    await page.getByLabel(/Scheduled date/).fill(d(5));
    await page.getByTestId("save-milestone").click();
    await expect(page.getByText(`rescheduled from ${d(3)}`)).toBeVisible();

    // Retest branch and approval vs oath are separate.
    await page.getByTestId("add-milestone").click();
    await page.getByLabel("Milestone").selectOption("retest");
    await page.getByLabel(/Scheduled date/).fill(d(80));
    await page.getByTestId("save-milestone").click();
    await expect(page.locator("summary", { hasText: "Interview outcome" })).toContainText("your stage");
    await page.getByTestId("add-milestone").click();
    await page.getByLabel("Milestone").selectOption("decision-approved");
    await page.getByLabel("Date").fill(d(1));
    await page.getByTestId("save-milestone").click();
    await expect(page.locator("summary", { hasText: "Decision and oath" })).toContainText("your stage");

    // Checklist: complete one item, set a reminder on another.
    const oathStage = page.locator("details", { hasText: "Decision and oath" });
    await oathStage.locator("summary").click({ force: true }).catch(() => {});
    const first = page.locator("#oath-notice");
    await first.getByRole("checkbox").check();
    await expect(first.locator("span.line-through")).toBeVisible();
    await page.locator("#oath-reschedule").getByLabel("Remind me on").fill(d(0));
    await expect(page.locator("li", { hasText: "checklist" })).toContainText("rescheduling");

    // .ics export carries the scheduled milestones.
    const download = page.waitForEvent("download");
    await page.getByTestId("export-ics").click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("oathsteps-reminders.ics");
    const text = await (await file.createReadStream()).toArray().then((b) => Buffer.concat(b).toString());
    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).toContain(`DTSTART;VALUE=DATE:${d(5).replace(/-/g, "")}`);
    expect(text).toContain("SUMMARY:Interview (OathSteps)");

    // Reminders also appear on Today.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Reminders" })).toBeVisible();
  });
});
