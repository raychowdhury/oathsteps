import { describe, expect, it } from "vitest";
import { appointmentReminders, buildIcs, emptyJourney, needsDate, slotFor, statusLabel, upNext, validateMilestone } from "./journey";

const TODAY = "2026-10-05";

describe("milestone slots", () => {
  it("derives 'filed' from the profile and labels statuses", () => {
    expect(slotFor(emptyJourney(), "filed", "2025-11-12")).toEqual({ status: "done", date: "2025-11-12" });
    expect(slotFor(emptyJourney(), "filed", null)).toEqual({ status: "none", date: "" });
    expect(statusLabel("bio", "reused")).toBe("Reused (no appointment)");
    expect(statusLabel("outcome", "nonsense")).toBe("Not yet");
    expect(needsDate("bio", "reused")).toBe(false);
    expect(needsDate("interview", "scheduled")).toBe(true);
  });
});

describe("milestone validation", () => {
  it("accepts none, reuse without a date, and a scheduled future date", () => {
    expect(validateMilestone({ key: "interview", status: "none", date: "" }, "2025-11-12", TODAY)).toBe("");
    expect(validateMilestone({ key: "bio", status: "reused", date: "" }, "2025-11-12", TODAY)).toBe("");
    expect(validateMilestone({ key: "interview", status: "scheduled", date: "2026-11-18" }, "2025-11-12", TODAY)).toBe("");
  });
  it("rejects attended dates in the future, dates before filing, and incomplete dates", () => {
    expect(validateMilestone({ key: "interview", status: "attended", date: "2026-12-01" }, "2025-11-12", TODAY)).toBe("That date is after today (Oct 5, 2026). If it hasn’t happened yet, choose “Scheduled”.");
    expect(validateMilestone({ key: "receipt", status: "done", date: "2025-10-01" }, "2025-11-12", TODAY)).toBe("This date is before your filing date (Nov 12, 2025). Check your notice.");
    expect(validateMilestone({ key: "interview", status: "scheduled", date: "" }, null, TODAY)).toBe("Enter the date from your notice.");
    expect(validateMilestone({ key: "interview", status: "scheduled", date: "2026-02-30" }, null, TODAY)).toMatch(/full date/);
    expect(validateMilestone({ key: "filed", status: "done", date: "2027-01-01" }, null, TODAY)).toBe("Your filing date can’t be in the future.");
  });
});

describe("coming up and reminders", () => {
  it("lists what is next from the slots", () => {
    const j = emptyJourney();
    expect(upNext(j, null, TODAY).map((x) => x.t)).toEqual(["Add your filing date.", "Add your interview date when it arrives."]);
    j.interview = { status: "scheduled", date: "2026-11-18" };
    j.decision = { status: "approved", date: "2026-11-18" };
    j.outcome = { status: "retest", date: "2026-12-01" };
    expect(upNext(j, "2025-11-12", TODAY).map((x) => x.t)).toEqual(["Interview on Nov 18, 2026. Read your notice and prepare what it asks for.", "Approved. Follow your oath notice.", "Retest: keep practicing."]);
  });
  it("fires appointment reminders 7 days, 1 day before and on the day", () => {
    const j = emptyJourney();
    j.interview = { status: "scheduled", date: "2026-10-12" };
    j.oath = { status: "rescheduled", date: "2026-10-06" };
    j.bio = { status: "attended", date: "2026-01-15" };
    expect(appointmentReminders(j, TODAY).map((r) => r.title)).toEqual(["Interview in 7 days", "Oath ceremony tomorrow"]);
    expect(appointmentReminders(j, "2026-10-12").map((r) => r.title)).toEqual(["Interview today"]);
  });
  it("exports all-day ICS events with escaped text", () => {
    const ics = buildIcs([{ uid: "a", date: "2026-02-05", summary: "Interview; bring notice, ID" }], new Date("2026-01-01T00:00:00Z"));
    expect(ics).toContain("DTSTART;VALUE=DATE:20260205");
    expect(ics).toContain("DTEND;VALUE=DATE:20260206");
    expect(ics).toContain("SUMMARY:Interview\\; bring notice\\, ID");
  });
});
