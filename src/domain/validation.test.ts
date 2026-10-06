import { describe, expect, it } from "vitest";
import { fmtDate, fmtLocalDay, validateFiling, validateInterviewDate } from "./validation";

const TODAY = "2026-10-05";

describe("filing date validation", () => {
  it("accepts a full past date and 'not sure'", () => {
    expect(validateFiling({ date: "2025-12-02", unsure: false }, TODAY)).toBe("");
    expect(validateFiling({ date: "", unsure: true }, TODAY)).toBe("");
  });
  it("explains each problem in plain words", () => {
    expect(validateFiling({ date: "", unsure: false }, TODAY)).toMatch(/Enter your filing date/);
    expect(validateFiling({ date: "2027-02-31", unsure: false }, TODAY)).toMatch(/full date/);
    expect(validateFiling({ date: "2027-02-14", unsure: false }, TODAY)).toMatch(/in the future/);
    expect(validateFiling({ date: "1980-01-01", unsure: false }, TODAY)).toMatch(/too early/);
  });
});

describe("interview date validation", () => {
  it("is optional, must be complete, and cannot precede filing", () => {
    expect(validateInterviewDate("", "2025-12-02")).toBe("");
    expect(validateInterviewDate("2026-13-01", null)).toMatch(/full date/);
    expect(validateInterviewDate("2025-11-01", "2025-12-02")).toBe("Your interview can’t be before your filing date (Dec 2, 2025).");
    expect(validateInterviewDate("2026-11-18", "2025-12-02")).toBe("");
  });
  it("formats dates for people", () => {
    expect(fmtDate("2026-01-15")).toBe("Jan 15, 2026");
    expect(fmtDate("")).toBe("");
    // 9 pm in New York on Oct 5 is already Oct 6 in UTC; the learner should see Oct 5.
    expect(fmtLocalDay("2026-10-06T01:30:00.000Z", "America/New_York")).toBe("Oct 5, 2026");
    expect(fmtLocalDay("2026-10-06T01:30:00.000Z", "UTC")).toBe("Oct 6, 2026");
    expect(fmtLocalDay(null)).toBe("");
  });
});
