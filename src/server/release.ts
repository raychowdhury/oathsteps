import { checkConfig, isLocal } from "./config";
import { legalInfo } from "./legal";
import { mailConfigured } from "./mail";

type Env = Record<string, string | undefined>;

export interface ContentState {
  packs: { id: string; humanReviewed: boolean }[];
  guide: boolean;
  english: boolean;
}
export interface Check {
  id: string;
  status: "ok" | "blocked";
  detail: string;
}

/** What still stands between this deployment and a public launch. Pure: the script supplies env and content state. */
export function releaseChecks(env: Env, content: ContentState): Check[] {
  const out: Check[] = [];
  const add = (id: string, ok: boolean, okDetail: string, blockedDetail: string) => out.push({ id, status: ok ? "ok" : "blocked", detail: ok ? okDetail : blockedDetail });

  const cfg = checkConfig({ ...env, NODE_ENV: "production" });
  add("configuration", cfg.errors.length === 0, "Secret and public address are valid.", cfg.errors.join(" "));

  let host = "";
  try {
    host = new URL(env.BETTER_AUTH_URL ?? "").hostname;
  } catch {
    /* reported by configuration */
  }
  add("public-address", Boolean(host) && !isLocal(host), `Served at https://${host}.`, "BETTER_AUTH_URL is missing or a local address. Set the public https address.");

  add("mail", mailConfigured(env), "Confirmation and password-reset emails are sent through the configured provider.", "No production mail provider. Set MAIL_PROVIDER=brevo (free) or resend, with its API key and MAIL_FROM, or accounts cannot confirm email or reset passwords.");

  const legal = legalInfo(env);
  add("legal-details", Boolean(legal.entity && (legal.contactEmail || legal.contactUrl)), `Operator named: ${legal.entity}.`, "Set LEGAL_ENTITY and LEGAL_CONTACT_EMAIL (or LEGAL_CONTACT_URL) so the Privacy notice and Terms name who runs the service.");
  add("legal-review", Boolean(legal.reviewedOn), `Privacy notice and Terms reviewed ${legal.reviewedOn}.`, "Privacy notice and Terms are still marked Draft. Have a lawyer review them, then set LEGAL_REVIEWED_ON.");

  for (const p of content.packs) add(`content-${p.id}`, p.humanReviewed, `${p.id} has a recorded expert review.`, `${p.id} is machine-checked only. Record an expert review (content/review/REVIEW.md).`);
  add("content-guide", content.guide, "Guide has a recorded expert review.", "Guide is a draft. Record an expert review (content/review/REVIEW.md).");
  add("content-english", content.english, "Interview English material has a recorded expert review.", "Interview English material is not expert-reviewed. Record a review (content/review/REVIEW.md).");
  return out;
}
