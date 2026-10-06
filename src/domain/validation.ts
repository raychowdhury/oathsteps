import { instantToDateOnly, isValidDateOnly } from "./dates";
import type { DateOnly, Instant } from "./types";

/** Human-friendly date, e.g. "Oct 5, 2026". Date-only, no time zone involved. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(iso: DateOnly | "" | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`;
}

/** The learner's local calendar day for a stored instant. Slicing the ISO string would show the UTC day, a day ahead on US evenings. */
export function fmtLocalDay(at: Instant | null | undefined, timeZone?: string): string {
  return at ? fmtDate(instantToDateOnly(at, timeZone)) : "";
}

export interface FilingInput {
  date: string;
  unsure: boolean;
}

/** Empty string means valid. Mirrors the prototype's wording. */
export function validateFiling(fd: FilingInput, today: DateOnly): string {
  if (fd.unsure) return "";
  if (!fd.date) return "Enter your filing date, or choose “I’m not sure”.";
  if (!isValidDateOnly(fd.date)) return "Enter a full date: month, day and year.";
  if (fd.date > today) return "That date is in the future. Check the date on your receipt notice.";
  if (fd.date < "1990-01-01") return "Check the year. That date looks too early.";
  return "";
}

export function validateInterviewDate(date: string, filing: DateOnly | null): string {
  if (!date) return "";
  if (!isValidDateOnly(date)) return "Enter a full date: month, day and year.";
  if (filing && date < filing) return `Your interview can’t be before your filing date (${fmtDate(filing)}).`;
  return "";
}
