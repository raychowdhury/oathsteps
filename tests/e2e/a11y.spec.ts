import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { setupProfile, startToday } from "./helpers";

const pages = ["/", "/practice", "/practice/session?kind=daily", "/practice/mock?kind=walkthrough", "/interview", "/interview/voice", "/interview/writing", "/journey", "/journey/guide", "/readiness", "/settings", "/account"];

test.describe.configure({ timeout: 240_000 });

test.describe("accessibility baseline", () => {
  test("no serious or critical axe violations on core screens, light and dark", async ({ page }, testInfo) => {
    await setupProfile(page, { filingDate: "2026-01-15" });
    const failures: string[] = [];
    for (const theme of ["light", "dark"] as const) {
      await page.goto("/settings");
      await page.getByLabel(theme === "dark" ? "Dark" : "Light").check();
      for (const path of pages) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        for (const v of serious) failures.push(`${theme} ${path}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
        await testInfo.attach(`axe-${theme}-${path.replace(/[^a-z]/gi, "_")}`, { body: JSON.stringify({ theme, path, violations: results.violations }, null, 2), contentType: "application/json" });
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  test("a card can be completed with the keyboard only", async ({ page }) => {
    await setupProfile(page, { filingDate: "2026-01-15" });
    await page.goto("/practice/session?kind=daily");
    const reveal = page.getByTestId("reveal");
    await reveal.focus();
    await expect(reveal).toBeFocused();
    await page.keyboard.press("Enter");
    const got = page.getByTestId("grade-got");
    await got.focus();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("q-position")).toHaveText("Question 2 of 5");
  });

  test("no horizontal overflow at 320px and 390px, with larger text", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await setupProfile(page, { filingDate: "2026-01-15" });
    for (const path of ["/", "/practice", "/journey", "/settings"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      expect(overflow, `${path} overflows at 320px`).toBe(false);
    }
    await page.goto("/settings");
    await page.getByLabel("Larger").check();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(startToday(page)).toBeVisible();
    const overflowLarge = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflowLarge).toBe(false);
  });
});
