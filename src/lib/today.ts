"use client";
import { daysBetween, todayDateOnly } from "@/domain/dates";
import { scheduledInterview, upNext, type Journey } from "@/domain/journey";
import { dueToday, isWeak } from "@/domain/scheduler";
import type { EnglishTaskRecord, ReviewState, StudyProfile } from "@/domain/types";
import { fmtDate } from "@/domain/validation";
import type { Question } from "./content";
import { practiceQuestions, routeForProfile, type Route } from "./path";
import { getDayProgress, getJourney, getMeta, getProfile, getSessions, listBookmarks, listEnglishTasks, listMocks, listReviewStates, type DayProgress } from "./store/repo";
import type { MockState } from "@/domain/mock";

export const DUE_CAP = 5;

export interface PlanTask {
  key: "review" | "fresh" | "english";
  title: string;
  why: string;
  time: string;
  mins: number;
  done: boolean;
}

export interface Snapshot {
  today: string;
  profile: StudyProfile;
  route: Route;
  questions: Question[];
  reviewStates: ReviewState[];
  bookmarks: string[];
  english: EnglishTaskRecord[];
  mocks: MockState[];
  journey: Journey;
  day: DayProgress;
  sessions: number;
  demo: boolean;
  downloaded: boolean;
}

export async function loadSnapshot(): Promise<Snapshot> {
  const today = todayDateOnly();
  const [profile, reviewStates, bookmarks, english, mocks, journey, day, sessions, demo, downloaded] = await Promise.all([
    getProfile(),
    listReviewStates(),
    listBookmarks(),
    listEnglishTasks(),
    listMocks(),
    getJourney(),
    getDayProgress(today),
    getSessions(),
    getMeta<boolean>("illustrative"),
    getMeta<{ at: string }>("offlineDownload"),
  ]);
  const route = routeForProfile(profile);
  return { today, profile, route, questions: practiceQuestions(route), reviewStates, bookmarks, english, mocks, journey, day, sessions, demo: Boolean(demo), downloaded: Boolean(downloaded) };
}

export function inBank(s: Snapshot): Set<string> {
  return new Set(s.questions.map((q) => q.id));
}

export function dueIds(s: Snapshot, cap = 999): string[] {
  const bank = inBank(s);
  return dueToday(
    s.reviewStates.filter((r) => bank.has(r.questionId)),
    s.today,
    cap,
  ).due.map((r) => r.questionId);
}

export function newIds(s: Snapshot): string[] {
  const seen = new Set(s.reviewStates.filter((r) => r.seenCount > 0).map((r) => r.questionId));
  return s.questions.filter((q) => !seen.has(q.id)).map((q) => q.id);
}

/** Not sure or review again last time, plus saved questions. */
export function weakIds(s: Snapshot): string[] {
  const bank = inBank(s);
  const weak = new Set(s.reviewStates.filter((r) => bank.has(r.questionId) && r.seenCount > 0 && (r.lastOutcome === "uncertain" || r.lastOutcome === "incorrect")).map((r) => r.questionId));
  for (const b of s.bookmarks) if (bank.has(b)) weak.add(b);
  return s.questions.filter((q) => weak.has(q.id)).map((q) => q.id);
}

/** Only unsure/missed (no bookmarks). */
export function uncertainIds(s: Snapshot): string[] {
  const bank = inBank(s);
  return s.reviewStates.filter((r) => bank.has(r.questionId) && r.seenCount > 0 && (r.lastOutcome === "uncertain" || r.lastOutcome === "incorrect")).map((r) => r.questionId);
}

export function planCounts(s: Snapshot): { due: number; nNew: number } {
  const due = Math.min(dueIds(s).length, DUE_CAP);
  const nNew = Math.min(newIds(s).length, s.sessions > 0 ? 3 : 5);
  return { due, nNew };
}

export function dailyIds(s: Snapshot): string[] {
  const c = planCounts(s);
  const ids = [...dueIds(s, DUE_CAP), ...newIds(s).slice(0, c.nNew)];
  return ids.length ? ids : s.questions.slice(0, 5).map((q) => q.id);
}

export function lastEnglish(s: Snapshot, kind: "reading" | "writing"): EnglishTaskRecord | undefined {
  return [...s.english].reverse().find((e) => e.kind === kind);
}

/** Writing is suggested when the last reading was more recent than the last writing or the last writing had a difference. */
export function suggestWriting(s: Snapshot): boolean {
  const r = lastEnglish(s, "reading");
  const w = lastEnglish(s, "writing");
  return Boolean(r && (!w || w.at <= r.at || w.outcome !== "correct"));
}

export function planTasks(s: Snapshot): PlanTask[] {
  const pc = planCounts(s);
  const td = s.day;
  const tasks: PlanTask[] = [];
  if (pc.due > 0 || td.review) tasks.push({ key: "review", title: `Review ${pc.due || "your"} due question${pc.due === 1 ? "" : "s"}`, why: "Helps answers stick", time: "About 5 min", mins: 5, done: td.review });
  if (pc.nNew > 0 || td.fresh) tasks.push({ key: "fresh", title: `Learn ${pc.nNew || "a few"} new question${pc.nNew === 1 ? "" : "s"}`, why: s.sessions > 0 ? "Small sets are easier" : "You’ll review them tomorrow", time: pc.nNew > 3 ? "About 6 min" : "About 4 min", mins: pc.nNew > 3 ? 6 : 4, done: td.fresh });
  const w = suggestWriting(s);
  tasks.push({ key: "english", title: w ? "Writing: one sentence" : "Reading: one sentence", why: w ? "Last try had a difference" : "Part of the interview", time: "About 3 min", mins: 3, done: td.english });
  return tasks;
}

export interface Countdown {
  text: string;
  sub: string;
  date: string;
}

export function countdown(s: Snapshot): Countdown | null {
  const iv = scheduledInterview(s.journey);
  if (!iv) return null;
  const dd = daysBetween(s.today, iv.date);
  const text = dd > 1 ? `Interview in ${dd} days` : dd === 1 ? "Interview tomorrow" : dd === 0 ? "Interview today" : "Your interview date has passed";
  return { text, sub: `${fmtDate(iv.date)}${iv.rescheduled ? " · rescheduled" : ""} · entered by you`, date: iv.date };
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function encountered(s: Snapshot): number {
  const bank = inBank(s);
  return s.reviewStates.filter((r) => bank.has(r.questionId) && r.seenCount > 0).length;
}

/** Recalled after a gap: an unprompted correct answer at least a day after the first unprompted correct answer, and still correct last time. */
export function delayedRecalled(s: Snapshot): number {
  const bank = inBank(s);
  return s.reviewStates.filter((r) => {
    if (!bank.has(r.questionId) || r.lastOutcome !== "correct" || r.unpromptedCorrectAt.length < 2) return false;
    const first = r.unpromptedCorrectAt[0].slice(0, 10);
    return r.unpromptedCorrectAt.some((at) => at.slice(0, 10) > first);
  }).length;
}

export function journeyNext(s: Snapshot): { title: string; sub: string; href: string } {
  const cd = countdown(s);
  if (cd && daysBetween(s.today, cd.date) >= 0) return { title: `Next: interview on ${fmtDate(cd.date)}`, sub: "Read your notice", href: "/journey/guide?open=notice" };
  return { title: "Add dates as notices arrive", sub: "Journey and guide", href: "/journey" };
}

export function readinessTeaser(s: Snapshot): string {
  const enc = encountered(s);
  const bank = s.questions.length;
  return enc ? `Seen ${enc} of ${bank} · recalled after a gap ${delayedRecalled(s)} of ${bank}` : "No practice yet";
}

export function isWeakState(r: ReviewState): boolean {
  return isWeak(r);
}

export { upNext };
