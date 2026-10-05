import { describe, expect, it } from "vitest";
import type { Milestone } from "@/domain/types";
import { defaultProfile } from "./store/repo";
import { buildIcs, currentStageId, dueReminders, nextPracticalTask } from "./journey";

const m = (kind: Milestone["kind"], date: string | null): Milestone => ({ id: kind, kind, date, provenance: "user", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" });

describe("journey stages", () => {
  it("derives the stage from the learner's milestones", () => {
    expect(currentStageId([])).toBe("prepare");
    expect(currentStageId([m("filed", "2026-01-01")])).toBe("receipt-biometrics");
    expect(currentStageId([m("filed", "2026-01-01"), m("biometrics-reused", null)])).toBe("interview-prep");
    expect(currentStageId([m("interview", "2026-03-01"), m("retest", "2026-05-01")])).toBe("outcome");
    expect(currentStageId([m("decision-approved", "2026-03-01")])).toBe("oath");
    expect(currentStageId([m("decision-approved", "2026-03-01"), m("oath", "2026-04-01")])).toBe("after");
  });

  it("offers the first incomplete task of the current stage", () => {
    const task = nextPracticalTask([m("filed", "2026-01-01")], [{ itemId: "receipt-read", completedAt: "2026-01-02T00:00:00Z", reminderOn: null }]);
    expect(task?.stage.id).toBe("receipt-biometrics");
    expect(task?.item.id).toBe("biometrics-appointment");
  });
});

describe("reminders", () => {
  const profile = defaultProfile();
  it("lists upcoming appointments, due checklist reminders and due study, by category", () => {
    const list = dueReminders({
      profile,
      today: "2026-02-01",
      hasDueCards: true,
      milestones: [m("interview", "2026-02-05"), m("oath", "2026-03-20"), m("filed", "2026-01-01")],
      checklist: [
        { itemId: "interview-notice", completedAt: null, reminderOn: "2026-01-31" },
        { itemId: "interview-logistics", completedAt: null, reminderOn: "2026-02-10" },
      ],
    });
    expect(list.map((r) => r.category)).toEqual(["checklist", "study", "appointments"]);
    expect(list.find((r) => r.category === "appointments")?.title).toBe("Interview");
  });

  it("respects disabled categories", () => {
    const list = dueReminders({ profile: { ...profile, reminders: { study: false, appointments: false, checklist: false } }, today: "2026-02-01", hasDueCards: true, milestones: [m("interview", "2026-02-05")], checklist: [{ itemId: "interview-notice", completedAt: null, reminderOn: "2026-01-31" }] });
    expect(list).toEqual([]);
  });

  it("exports all-day ICS events with escaped text", () => {
    const ics = buildIcs([{ uid: "a", date: "2026-02-05", summary: "Interview; bring notice, ID" }]);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260205");
    expect(ics).toContain("DTEND;VALUE=DATE:20260206");
    expect(ics).toContain("SUMMARY:Interview\\; bring notice\\, ID");
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
  });
});
