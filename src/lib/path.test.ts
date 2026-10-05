import { describe, expect, it } from "vitest";
import { practiceBank, practiceQuestions, routeFor } from "./path";

describe("routeFor (design wording)", () => {
  it("names the path, its lines and reason", () => {
    const r = routeFor({ filingDate: "2025-12-02", filingDateUnknown: false, specialConsideration: false });
    expect(r).toMatchObject({ key: "2025", name: "2025 civics test", short: "2025 civics test", bank: 128, asked: 20, src: "q128" });
    expect(r.lines).toEqual(["128 questions to study", "Up to 20 asked · 12 correct to pass", "Stops at 12 correct or 9 incorrect"]);
    const o = routeFor({ filingDate: "2025-10-19", filingDateUnknown: false, specialConsideration: false });
    expect(o).toMatchObject({ key: "2008", bank: 100, asked: 10, src: "q100", reason: "Filed before Oct 20, 2025." });
  });
  it("applies the 65/20 format on top of the version", () => {
    const r = routeFor({ filingDate: "2025-12-02", filingDateUnknown: false, specialConsideration: true });
    expect(r.short).toBe("2025 civics test · 65/20");
    expect(r.name).toBe("2025 civics test, 65/20 format");
    expect(r.bank).toBe(20);
    expect(r.asked).toBe(10);
    expect(r.reason).toMatch(/You chose the 65\/20 format/);
    expect(practiceQuestions(r)).toHaveLength(20);
  });
  it("keeps an unknown version unknown but labels what is practiced", () => {
    const r = routeFor({ filingDate: null, filingDateUnknown: true, specialConsideration: false });
    expect(r.key).toBe("none");
    expect(r.short).toBe("Test version not set");
    expect(r.mock).toBe("Add your filing date to see your format.");
    expect(practiceBank(r)).toBe("2025");
  });
});
