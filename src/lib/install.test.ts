import { describe, expect, it } from "vitest";
import { needsHomeScreenTip } from "./install";

const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ipadAsMac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const android = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

describe("Home Screen tip", () => {
  it("shows on iPhone and iPad until the app runs from the Home Screen", () => {
    expect(needsHomeScreenTip(iphone, false, 5)).toBe(true);
    expect(needsHomeScreenTip(iphone, true, 5)).toBe(false);
    expect(needsHomeScreenTip(ipadAsMac, false, 5)).toBe(true);
  });

  it("does not show on Android or a Mac", () => {
    expect(needsHomeScreenTip(android, false, 5)).toBe(false);
    expect(needsHomeScreenTip(ipadAsMac, false, 0)).toBe(false);
  });
});
