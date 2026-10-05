import { mailProvider } from "./mail";

const PROVIDER_NAMES = { resend: "Resend", brevo: "Brevo" } as const;

type Env = Record<string, string | undefined>;

/** Operator details for the Privacy notice and Terms. Read at request time so one image serves any operator. */
export interface LegalInfo {
  entity: string | null;
  contactEmail: string | null;
  /** A public contact page, for example a GitHub issues URL. Must be https. */
  contactUrl: string | null;
  jurisdiction: string | null;
  mailProvider: string | null;
  /** Date (YYYY-MM-DD) a lawyer signed off on the text. Null keeps the "Draft" notice on both pages. */
  reviewedOn: string | null;
}

export function legalInfo(env: Env = process.env): LegalInfo {
  const v = (k: string) => env[k]?.trim() || null;
  const email = v("LEGAL_CONTACT_EMAIL");
  const url = v("LEGAL_CONTACT_URL");
  const reviewed = v("LEGAL_REVIEWED_ON");
  return {
    entity: v("LEGAL_ENTITY"),
    contactEmail: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    contactUrl: url && /^https:\/\/[^\s]+$/.test(url) ? url : null,
    jurisdiction: v("LEGAL_JURISDICTION"),
    mailProvider: (() => { const p = mailProvider(env); return p === "resend" || p === "brevo" ? PROVIDER_NAMES[p] : null; })(),
    reviewedOn: reviewed && /^\d{4}-\d{2}-\d{2}$/.test(reviewed) ? reviewed : null,
  };
}
