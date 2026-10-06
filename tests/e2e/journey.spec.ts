import { expect, test } from "@playwright/test";
import { errorLine, localDay, setupProfile } from "./helpers";

const d = localDay;

test.describe.configure({ timeout: 120_000 });

test.describe("journey timeline, guide and reminders", () => {
  test("milestone slots with validation, reuse, retest, rescheduling, approval vs oath, and calendar export", async ({ page }) => {
    await setupProfile(page, { filingDate: "2026-01-15" });
    await page.goto("/journey");
    await expect(page.getByTestId("ms-filed")).toContainText("Filed · Jan 15, 2026 · Manually entered");
    await expect(page.getByTestId("ms-filed")).toContainText("Sets your test: 2025 civics test.");

    // Receipt before filing is rejected.
    await page.getByRole("button", { name: "Edit Receipt notice" }).click();
    await page.getByLabel("Status").selectOption("done");
    await page.getByLabel("Date", { exact: true }).fill("2026-01-01");
    await page.getByTestId("save-milestone").click();
    await expect(errorLine(page)).toContainText("This date is before your filing date (Jan 15, 2026). Check your notice.");
    await page.getByLabel("Date", { exact: true }).fill("2026-01-27");
    await page.getByTestId("save-milestone").click();
    await expect(page.getByText("Receipt notice saved.")).toBeVisible();
    await expect(page.getByTestId("ms-receipt")).toContainText("Received · Jan 27, 2026");

    // Biometrics reused needs no date.
    await page.getByRole("button", { name: "Edit Biometrics" }).click();
    await page.getByLabel("Status").selectOption("reused");
    await page.getByTestId("save-milestone").click();
    await expect(page.getByTestId("ms-bio")).toContainText("Reused (no appointment) · No appointment · Manually entered");

    // Attended interview in the future is rejected with the design's message; scheduled works.
    await page.getByRole("button", { name: "Edit Interview", exact: true }).click();
    await page.getByLabel("Status").selectOption("attended");
    await page.getByLabel("Date", { exact: true }).fill(d(30));
    await page.getByTestId("save-milestone").click();
    await expect(errorLine(page)).toContainText("If it hasn’t happened yet, choose “Scheduled”.");
    await page.getByLabel("Status").selectOption("scheduled");
    await page.getByTestId("save-milestone").click();
    await expect(page.getByTestId("ms-interview")).toContainText("Scheduled");
    await expect(page.getByText(/Interview on .* Read your notice and prepare what it asks for\./)).toBeVisible();
    // Reschedule.
    await page.getByRole("button", { name: "Edit Interview", exact: true }).click();
    await page.getByLabel("Status").selectOption("rescheduled");
    await page.getByLabel("Appointment date").fill(d(45));
    await page.getByTestId("save-milestone").click();
    await expect(page.getByTestId("ms-interview")).toContainText("Rescheduled");
    await page.goto("/");
    await expect(page.getByTestId("countdown")).toContainText("Interview in 45 days");
    await expect(page.getByTestId("countdown")).toContainText("rescheduled");

    // Retest and approval; approval does not complete the oath.
    await page.goto("/journey");
    await page.getByRole("button", { name: "Edit Interview result" }).click();
    await page.getByLabel("Status").selectOption("retest");
    await page.getByLabel("Appointment date").fill(d(80));
    await page.getByTestId("save-milestone").click();
    await expect(page.getByTestId("ms-outcome")).toContainText("Usually 60–90 days later.");
    await expect(page.getByText("Retest: keep practicing.")).toBeVisible();
    await page.getByRole("button", { name: "Edit Decision" }).click();
    await page.getByLabel("Status").selectOption("approved");
    await page.getByLabel("Date", { exact: true }).fill(d(-1));
    await page.getByTestId("save-milestone").click();
    await expect(page.getByText("Approved. Follow your oath notice.")).toBeVisible();
    await expect(page.getByTestId("ms-oath")).toContainText("Not scheduled");

    // Calendar export carries the scheduled dates.
    const download = page.waitForEvent("download");
    await page.getByTestId("export-ics").click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("oathsteps-appointments.ics");
    const text = await (await file.createReadStream()).toArray().then((b) => Buffer.concat(b).toString());
    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).toContain(`DTSTART;VALUE=DATE:${d(45).replace(/-/g, "")}`);
    expect(text).toContain("SUMMARY:Interview (OathSteps)");
  });

  test("guide tasks can be completed with undo, expanded for sources, and set as reminders", async ({ page }) => {
    await setupProfile(page, { filingDate: "2026-01-15" });
    await page.goto("/journey");
    await expect(page.getByText("1 of 18 done")).toBeVisible(); // 'path' is marked by setup
    await page.getByRole("link", { name: /Preparation guide/ }).click();
    await expect(page.getByRole("heading", { name: "Preparation guide" })).toBeVisible();
    await expect(page.getByText("Draft, not expert-reviewed.")).toBeVisible();
    const task = page.getByTestId("task-notice");
    await task.getByRole("button", { name: /Show details/ }).click();
    await expect(task).toContainText("Your notice is the authority for your appointment.");
    await task.getByLabel("Remind me").check();
    await expect(page.getByText("Reminder saved for this step (study reminder).")).toBeVisible();
    await task.getByRole("checkbox", { name: "Read your appointment notice" }).check();
    await expect(page.getByText("Marked done: Read your appointment notice")).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(task.getByRole("checkbox", { name: "Read your appointment notice" })).not.toBeChecked();
    // A source link is official and opens in a new tab.
    const exceptions = page.getByTestId("task-exceptions");
    await exceptions.getByRole("button", { name: /Show details/ }).click();
    await expect(exceptions.getByRole("link", { name: /8 CFR Part 312/ })).toHaveAttribute("target", "_blank");
    // Reminder shows on Journey.
    await page.goto("/journey");
    await expect(page.getByText("Read your appointment notice")).toBeVisible();
  });
});
