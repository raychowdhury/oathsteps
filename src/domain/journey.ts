import { isValidDateOnly } from "./dates";
import type { DateOnly } from "./types";
import { fmtDate } from "./validation";

/** Seven milestone slots, as in the design. "filed" is derived from the profile's filing date. */
export type MilestoneKey = "filed" | "receipt" | "bio" | "interview" | "outcome" | "decision" | "oath";
export type JourneyKey = Exclude<MilestoneKey, "filed">;

export interface Slot {
  status: string;
  date: DateOnly | "";
}
export type Journey = Record<JourneyKey, Slot>;

export interface MilestoneDef {
  key: MilestoneKey;
  title: string;
  opts: [string, string][];
}

export const MILESTONES: MilestoneDef[] = [
  { key: "filed", title: "Filed Form N-400", opts: [["none", "Not entered"], ["done", "Filed"]] },
  { key: "receipt", title: "Receipt notice", opts: [["none", "Not yet"], ["done", "Received"]] },
  { key: "bio", title: "Biometrics", opts: [["none", "Not yet"], ["scheduled", "Scheduled"], ["attended", "Attended"], ["reused", "Reused (no appointment)"]] },
  { key: "interview", title: "Interview", opts: [["none", "Not scheduled"], ["scheduled", "Scheduled"], ["rescheduled", "Rescheduled"], ["attended", "Attended"]] },
  { key: "outcome", title: "Interview result", opts: [["none", "Not yet"], ["passed", "Passed the tests"], ["continued", "Continued"], ["retest", "Retest scheduled"], ["evidence", "Asked for more evidence"], ["other", "Something else"]] },
  { key: "decision", title: "Decision", opts: [["none", "Not yet"], ["approved", "Approved"], ["denied", "Denied"], ["other", "Something else"]] },
  { key: "oath", title: "Oath ceremony", opts: [["none", "Not scheduled"], ["scheduled", "Scheduled"], ["rescheduled", "Rescheduled"], ["completed", "Oath taken"]] },
];

export const DONE_STATES = new Set(["done", "attended", "reused", "passed", "approved", "completed"]);
export const PENDING_STATES = new Set(["scheduled", "rescheduled", "retest", "continued", "evidence"]);
export const NOTED_STATES = new Set(["denied", "other"]);

export function emptyJourney(): Journey {
  return { receipt: { status: "none", date: "" }, bio: { status: "none", date: "" }, interview: { status: "none", date: "" }, outcome: { status: "none", date: "" }, decision: { status: "none", date: "" }, oath: { status: "none", date: "" } };
}

export function slotFor(journey: Journey, key: MilestoneKey, filing: DateOnly | null): Slot {
  if (key === "filed") return filing ? { status: "done", date: filing } : { status: "none", date: "" };
  return journey[key];
}

export function statusLabel(key: MilestoneKey, status: string): string {
  const def = MILESTONES.find((m) => m.key === key)!;
  return (def.opts.find((o) => o[0] === status) ?? def.opts[0])[1];
}

export function needsDate(key: MilestoneKey, status: string): boolean {
  return status !== "none" && !(key === "bio" && status === "reused");
}

/** Empty string means valid. Mirrors the prototype's rules and wording. */
export function validateMilestone(input: { key: MilestoneKey; status: string; date: string }, filing: DateOnly | null, today: DateOnly): string {
  const { key, status, date } = input;
  if (status === "none") return "";
  if (!needsDate(key, status) && !date) return "";
  if (!date) return "Enter the date from your notice.";
  if (!isValidDateOnly(date)) return "Enter a full date: month, day and year.";
  if (key === "filed" && date > today) return "Your filing date can’t be in the future.";
  if (DONE_STATES.has(status) && date > today) return `That date is after today (${fmtDate(today)}). If it hasn’t happened yet, choose “Scheduled”.`;
  if (key !== "filed" && filing && date < filing) return `This date is before your filing date (${fmtDate(filing)}). Check your notice.`;
  return "";
}

export interface UpNext {
  t: string;
}

/** "Coming up" lines for the Journey screen. */
export function upNext(journey: Journey, filing: DateOnly | null, today: DateOnly): UpNext[] {
  const out: UpNext[] = [];
  const iv = journey.interview;
  const hasInt = (iv.status === "scheduled" || iv.status === "rescheduled") && !!iv.date;
  if (!filing) out.push({ t: "Add your filing date." });
  if (hasInt && iv.date >= today) out.push({ t: `Interview on ${fmtDate(iv.date)}. Read your notice and prepare what it asks for.` });
  if (!hasInt && iv.status === "none") out.push({ t: "Add your interview date when it arrives." });
  if (journey.decision.status === "approved" && journey.oath.status !== "completed") out.push({ t: "Approved. Follow your oath notice." });
  if (journey.outcome.status === "retest") out.push({ t: "Retest: keep practicing." });
  if (!out.length) out.push({ t: "Nothing right now." });
  return out;
}

/** Scheduled interview or oath date for countdowns, if any. */
export function scheduledInterview(journey: Journey): { date: DateOnly; rescheduled: boolean } | null {
  const iv = journey.interview;
  if ((iv.status === "scheduled" || iv.status === "rescheduled") && iv.date) return { date: iv.date, rescheduled: iv.status === "rescheduled" };
  return null;
}

export interface Reminder {
  id: string;
  category: "study" | "appointments";
  title: string;
  date: DateOnly;
}

/** Appointment reminders fire 7 days and 1 day before a scheduled date, plus on the day. */
export function appointmentReminders(journey: Journey, today: DateOnly): Reminder[] {
  const out: Reminder[] = [];
  for (const key of ["bio", "interview", "oath"] as const) {
    const s = journey[key];
    if (!PENDING_STATES.has(s.status) || !s.date) continue;
    const title = MILESTONES.find((m) => m.key === key)!.title;
    const diff = Math.round((Date.parse(`${s.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
    if (diff === 7 || diff === 1 || diff === 0) out.push({ id: `appt:${key}:${s.date}`, category: "appointments", title: diff === 0 ? `${title} today` : diff === 1 ? `${title} tomorrow` : `${title} in 7 days`, date: s.date });
  }
  return out;
}

/** Minimal RFC 5545 calendar with all-day events. Dates are date-only, so no time zone conversion happens. */
export function buildIcs(events: { uid: string; date: DateOnly; summary: string; description?: string }[], now = new Date()): string {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const next = (d: DateOnly) => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10).replace(/-/g, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OathSteps//EN", "CALSCALE:GREGORIAN"];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}@oathsteps`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${e.date.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${next(e.date)}`, `SUMMARY:${esc(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
