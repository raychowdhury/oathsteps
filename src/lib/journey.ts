import { addDays, compareDateOnly } from "@/domain/dates";
import type { ChecklistEntry, DateOnly, Milestone, MilestoneKind, StudyProfile } from "@/domain/types";
import { guide, type GuideItem, type GuideStage } from "./content";

export const MILESTONE_LABELS: Record<MilestoneKind, string> = {
  filed: "N-400 filed",
  receipt: "Receipt notice received",
  "biometrics-attended": "Biometrics appointment",
  "biometrics-reused": "Biometrics reused (no appointment)",
  interview: "Interview",
  "interview-continued": "Interview continued",
  retest: "Retest scheduled",
  "evidence-requested": "Evidence requested",
  "decision-approved": "Application approved",
  "decision-denied": "Application denied",
  oath: "Oath ceremony",
};

export const SCHEDULED_KINDS: MilestoneKind[] = ["biometrics-attended", "interview", "retest", "oath"];

export type StageId = "prepare" | "filing" | "receipt-biometrics" | "interview-prep" | "outcome" | "oath" | "after";

/** Which guide stage the learner is in, derived from their own milestones. */
export function currentStageId(milestones: readonly Milestone[]): StageId {
  const kinds = new Set(milestones.map((m) => m.kind));
  if (kinds.has("oath")) return "after";
  if (kinds.has("decision-approved")) return "oath";
  if (kinds.has("decision-denied") || kinds.has("interview-continued") || kinds.has("retest") || kinds.has("evidence-requested")) return "outcome";
  if (kinds.has("interview") || kinds.has("receipt") || kinds.has("biometrics-attended") || kinds.has("biometrics-reused")) return "interview-prep";
  if (kinds.has("filed")) return "receipt-biometrics";
  return "prepare";
}

export function stageById(id: string): GuideStage | undefined {
  return guide.stages.find((s) => s.id === id);
}

export function nextPracticalTask(milestones: readonly Milestone[], checklist: readonly ChecklistEntry[]): { item: GuideItem; stage: GuideStage } | null {
  const stage = stageById(currentStageId(milestones));
  if (!stage) return null;
  const done = new Set(checklist.filter((c) => c.completedAt).map((c) => c.itemId));
  const item = stage.items.find((i) => !done.has(i.id));
  return item ? { item, stage } : null;
}

export interface Reminder {
  id: string;
  category: "study" | "appointments" | "checklist";
  title: string;
  date: DateOnly;
  detail?: string;
}

export function dueReminders(input: { profile: StudyProfile; milestones: readonly Milestone[]; checklist: readonly ChecklistEntry[]; today: DateOnly; hasDueCards: boolean }): Reminder[] {
  const out: Reminder[] = [];
  const horizon = addDays(input.today, 7);
  if (input.profile.reminders.appointments) {
    for (const m of input.milestones) {
      if (!m.date || !SCHEDULED_KINDS.includes(m.kind)) continue;
      if (compareDateOnly(m.date, input.today) >= 0 && compareDateOnly(m.date, horizon) <= 0) {
        out.push({ id: `appt:${m.id}`, category: "appointments", title: MILESTONE_LABELS[m.kind], date: m.date, detail: "Read your notice and confirm its instructions." });
      }
    }
  }
  if (input.profile.reminders.checklist) {
    for (const c of input.checklist) {
      if (c.completedAt || !c.reminderOn || compareDateOnly(c.reminderOn, input.today) > 0) continue;
      const item = guide.stages.flatMap((s) => s.items).find((i) => i.id === c.itemId);
      if (item) out.push({ id: `task:${c.itemId}`, category: "checklist", title: item.text, date: c.reminderOn });
    }
  }
  if (input.profile.reminders.study && input.hasDueCards) {
    out.push({ id: "study:today", category: "study", title: "Answers are due for review today", date: input.today });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Minimal RFC 5545 calendar with all-day events. Dates are date-only, so no time zone conversion happens. */
export function buildIcs(events: { uid: string; date: DateOnly; summary: string; description?: string }[]): string {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OathSteps//EN", "CALSCALE:GREGORIAN"];
  for (const e of events) {
    const d = e.date.replace(/-/g, "");
    lines.push("BEGIN:VEVENT", `UID:${e.uid}@oathsteps`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${addDays(e.date, 1).replace(/-/g, "")}`, `SUMMARY:${esc(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
