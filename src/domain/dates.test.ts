import { describe, expect, it } from "vitest";
import { addDays, compareDateOnly, daysBetween, fixedClock, instantToDateOnly, isValidDateOnly, todayDateOnly } from "./dates";

describe("date-only values", () => {
  it("validates calendar dates strictly", () => {
    expect(isValidDateOnly("2025-10-20")).toBe(true);
    expect(isValidDateOnly("2025-02-30")).toBe(false);
    expect(isValidDateOnly("2025-13-01")).toBe(false);
    expect(isValidDateOnly("2025-1-1")).toBe(false);
    expect(isValidDateOnly(20251020)).toBe(false);
  });

  it("compares and counts days without time-of-day or DST drift", () => {
    expect(compareDateOnly("2025-10-19", "2025-10-20")).toBe(-1);
    expect(daysBetween("2025-03-08", "2025-03-10")).toBe(2); // across US DST change
    expect(daysBetween("2025-10-20", "2025-10-19")).toBe(-1);
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("derives today from the learner's time zone, not UTC", () => {
    const clock = fixedClock("2025-10-20T03:30:00Z"); // still Oct 19 in Los Angeles
    expect(todayDateOnly(clock, "UTC")).toBe("2025-10-20");
    expect(todayDateOnly(clock, "America/Los_Angeles")).toBe("2025-10-19");
    expect(instantToDateOnly("2025-10-20T03:30:00Z", "Asia/Tokyo")).toBe("2025-10-20");
  });
});
