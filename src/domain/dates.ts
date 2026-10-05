import type { DateOnly, Instant } from "./types";

/** Injectable clock so every date rule is testable. */
export interface Clock {
  now(): Date;
}
export const systemClock: Clock = { now: () => new Date() };
export const fixedClock = (iso: string): Clock => ({ now: () => new Date(iso) });

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDateOnly(value: unknown): value is DateOnly {
  if (typeof value !== "string") return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function assertDateOnly(value: string): DateOnly {
  if (!isValidDateOnly(value)) throw new RangeError(`Invalid date-only value: ${value}`);
  return value;
}

/** Lexicographic comparison is correct for zero-padded YYYY-MM-DD. */
export function compareDateOnly(a: DateOnly, b: DateOnly): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

function toUtcMidnight(d: DateOnly): number {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: DateOnly, to: DateOnly): number {
  return Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / 86_400_000);
}

export function addDays(d: DateOnly, days: number): DateOnly {
  const dt = new Date(toUtcMidnight(d) + days * 86_400_000);
  return dt.toISOString().slice(0, 10);
}

/**
 * Today's calendar date in the learner's time zone. Uses the device zone by
 * default; filing-date comparisons never depend on the time of day.
 */
export function todayDateOnly(clock: Clock = systemClock, timeZone?: string): DateOnly {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  // en-CA yields YYYY-MM-DD.
  return fmt.format(clock.now());
}

export function instantToDateOnly(at: Instant, timeZone?: string): DateOnly {
  return todayDateOnly({ now: () => new Date(at) }, timeZone);
}

export function hoursBetween(a: Instant, b: Instant): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
}
