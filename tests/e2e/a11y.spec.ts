import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { setupProfile } from "./helpers";

const pages = ["/", "/practice", "/practice/session?mode=today", "/practice/mock", "/interview", "/journey", "/readiness", "/settings", "/account"];

test.describe("accessibility baseline", () => {
  test("no serious or critical axe violations on core screens", async ({ page }, testInfo) => {
    await setupProfile(page, { filingDate: "2026-01-15" });
    const failures: string[] = [];
    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      for (const v of serious) failures.push(`${path}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
      await testInfo.attach(`axe-${path.replace(/[^a-z]/gi, "_")}`, { body: JSON.stringify({ path, violations: results.violations }, null, 2), contentType: "application/json" });
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  test("a card can be completed with the keyboard only and focus stays visible", async ({ page }) => {
    await setupProfile(page, { filingDate: "2026-01-15" });
    await page.goto("/practice/session?mode=today");
    const show = page.getByRole("button", { name: "Show answer" });
    await show.focus();
    await expect(show).toBeFocused();
    await page.keyboard.press("Enter");
    const got = page.getByRole("button", { name: "Got it" });
    await got.focus();
    await page.keyboard.press("Space");
    await expect(page.getByText("2 of 5")).toBeVisible();
  });

  test("layout has no horizontal overflow at 390px and text resizing keeps the start button usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupProfile(page, { filingDate: "2026-01-15" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
    await page.goto("/settings");
    await page.getByLabel("Text size").selectOption("xlarge");
    await page.goto("/");
    await expect(page.getByTestId("start-today")).toBeVisible();
    const overflowLarge = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflowLarge).toBe(false);
  });
});
