import { en, type Messages } from "./en";

export interface LocaleEntry {
  code: string;
  label: string;
  messages: Messages;
  /** Who reviewed the translation and when. Required before a locale can be offered. */
  review: { reviewedBy: string; reviewedAt: string } | null;
}

/** Shipped locales. Only entries with a recorded review are offered to learners. */
export const LOCALES: LocaleEntry[] = [{ code: "en", label: "English", messages: en, review: { reviewedBy: "source language", reviewedAt: "2026-10-05" } }];

export const DEFAULT_LOCALE = "en";

export function offeredLocales(): LocaleEntry[] {
  return LOCALES.filter((l) => l.review !== null);
}

/** True when there is a genuine choice to make. The UI shows no selector otherwise. */
export function hasLanguageChoice(): boolean {
  return offeredLocales().length > 1;
}

export function messages(code: string = DEFAULT_LOCALE): Messages {
  return offeredLocales().find((l) => l.code === code)?.messages ?? en;
}

/** Dot-path lookup: t("nav.today"). Falls back to the key so missing strings are visible, never blank. */
export function t(path: string, code: string = DEFAULT_LOCALE): string {
  const value = path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), messages(code));
  return typeof value === "string" ? value : path;
}
