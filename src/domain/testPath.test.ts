import { describe, expect, it } from "vitest";
import { bankForFilingDate, CUTOVER_DATE, resolveTestPath, RULES } from "./testPath";

describe("test path routing", () => {
  it("uses the 2025-10-20 filing boundary", () => {
    expect(CUTOVER_DATE).toBe("2025-10-20");
    expect(bankForFilingDate("2025-10-19")).toBe("2008");
    expect(bankForFilingDate("2025-10-20")).toBe("2025");
    expect(bankForFilingDate("2025-10-21")).toBe("2025");
    expect(bankForFilingDate("2019-01-01")).toBe("2008");
  });

  it("rejects malformed dates instead of guessing", () => {
    expect(() => bankForFilingDate("10/19/2025")).toThrow(RangeError);
    expect(() => bankForFilingDate("2025-10-32")).toThrow(RangeError);
  });

  it("keeps an unknown filing date unknown (no silent default)", () => {
    const path = resolveTestPath({ filingDate: null });
    expect(path.status).toBe("unknown");
    expect(path.bank).toBeNull();
    expect(path.rules).toBeNull();
    expect(path.explanation).toMatch(/filed/i);
  });

  it("labels a learner-chosen bank as provisional", () => {
    const path = resolveTestPath({ filingDate: null, provisionalBank: "2025" });
    expect(path.status).toBe("provisional");
    expect(path.bank).toBe("2025");
    expect(path.rules).toEqual(RULES["2025"].standard);
  });

  it("applies the 65/20 rules to the determined bank", () => {
    const p2025 = resolveTestPath({ filingDate: "2026-01-05", specialConsideration: true });
    expect(p2025.bank).toBe("2025");
    expect(p2025.special).toBe(true);
    expect(p2025.rules).toEqual({ asked: 10, pass: 6, stopIncorrect: 5 });
    const p2008 = resolveTestPath({ filingDate: "2025-10-19", specialConsideration: false });
    expect(p2008.rules).toEqual({ asked: 10, pass: 6, stopIncorrect: 5 });
    expect(resolveTestPath({ filingDate: "2025-10-20" }).rules).toEqual({ asked: 20, pass: 12, stopIncorrect: 9 });
  });

  it("filing date wins over a provisional choice", () => {
    const path = resolveTestPath({ filingDate: "2025-10-19", provisionalBank: "2025" });
    expect(path.bank).toBe("2008");
    expect(path.basis).toBe("filing-date");
  });
});
