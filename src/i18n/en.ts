/**
 * English message catalogue. Keys are stable identifiers; values are the only shipped language.
 * A new language is added as another file with the same shape and listed in `index.ts` only
 * after a qualified bilingual review is recorded there. No language selector appears until then.
 */
export const en = {
  app: { name: "OathSteps", tagline: "Practice. Prepare. Track your journey." },
  nav: { today: "Today", practice: "Practice", interview: "Interview", journey: "Journey", settings: "Settings", skip: "Skip to content" },
  common: { loading: "Loading", back: "Back", save: "Save", cancel: "Cancel", next: "Next" },
  disclaimer: "OathSteps is a private study tool, not a government service and not legal advice.",
} as const;

export type Messages = typeof en;
