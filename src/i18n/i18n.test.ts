import { describe, expect, it } from "vitest";
import { hasLanguageChoice, offeredLocales, t } from "./index";

describe("i18n structure", () => {
  it("offers only reviewed locales and therefore no language choice yet", () => {
    expect(offeredLocales().map((l) => l.code)).toEqual(["en"]);
    expect(hasLanguageChoice()).toBe(false);
  });

  it("resolves dot paths and falls back to the key for missing strings", () => {
    expect(t("nav.today")).toBe("Today");
    expect(t("app.tagline")).toBe("Practice. Prepare. Track your journey.");
    expect(t("nav.missing")).toBe("nav.missing");
    expect(t("nav.today", "xx")).toBe("Today");
  });
});
