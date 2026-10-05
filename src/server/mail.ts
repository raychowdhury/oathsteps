import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Mail delivery. Transports:
 *  - `brevo`: free tier, no domain needed. Needs BREVO_API_KEY and MAIL_FROM (an address verified as a sender in Brevo).
 *  - `resend`: needs RESEND_API_KEY and MAIL_FROM on a domain verified at Resend.
 *  - `sink`: development and tests. Each message is written as an .eml file under MAIL_SINK_DIR.
 * MAIL_PROVIDER picks one; when unset, the sink is used only if MAIL_SINK_DIR is set. With neither, sending fails
 * loudly instead of pretending the mail went out. Adding another provider is one more branch in `deliverMail`.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export type MailResult = { delivered: "sink"; path: string } | { delivered: "resend" | "brevo"; id: string | null };
export type MailProvider = "resend" | "brevo" | "sink" | "none";

/** Providers that deliver over an HTTPS API, and the environment variable holding each one's key. */
export const API_KEY_VAR = { resend: "RESEND_API_KEY", brevo: "BREVO_API_KEY" } as const;

type Env = Record<string, string | undefined>;

export function mailProvider(env: Env = process.env): MailProvider {
  const p = env.MAIL_PROVIDER?.trim().toLowerCase();
  if (p === "resend" || p === "brevo") return p;
  if (p === "sink" || (!p && env.MAIL_SINK_DIR)) return "sink";
  return "none";
}

/** True when a real provider is chosen and has both its key and a sender. */
export function mailConfigured(env: Env = process.env): boolean {
  const p = mailProvider(env);
  return (p === "resend" || p === "brevo") && Boolean(env[API_KEY_VAR[p]]) && Boolean(env.MAIL_FROM);
}

/** "no-reply@example.org" or "Name <no-reply@example.org>". */
export function parseFrom(from: string): { name?: string; email: string } | null {
  const plain = from.trim().match(/^[^\s<>@"]+@[^\s<>@"]+\.[^\s<>@"]+$/);
  if (plain) return { email: plain[0] };
  const named = from.trim().match(/^"?([^"<>]*?)"?\s*<([^\s<>@"]+@[^\s<>@"]+\.[^\s<>@"]+)>$/);
  if (!named) return null;
  return named[1] ? { name: named[1], email: named[2] } : { email: named[2] };
}

export async function deliverMail(msg: MailMessage, opts: { env?: Env; fetch?: typeof fetch } = {}): Promise<MailResult> {
  const env = opts.env ?? process.env;
  const provider = mailProvider(env);

  if (provider === "resend") {
    const key = env.RESEND_API_KEY;
    const from = env.MAIL_FROM;
    if (!key || !from) throw new Error("MAIL_PROVIDER=resend needs RESEND_API_KEY and MAIL_FROM (docs/OPERATIONS.md).");
    const res = await (opts.fetch ?? fetch)("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, text: msg.text }),
      signal: AbortSignal.timeout(10_000),
    });
    // The response body can echo the recipient, so only the status is surfaced.
    if (!res.ok) throw new Error(`Mail provider rejected the message (HTTP ${res.status}).`);
    const body = (await res.json().catch(() => null)) as { id?: string } | null;
    return { delivered: "resend", id: body?.id ?? null };
  }

  if (provider === "brevo") {
    const key = env.BREVO_API_KEY;
    if (!key || !env.MAIL_FROM) throw new Error("MAIL_PROVIDER=brevo needs BREVO_API_KEY and MAIL_FROM (docs/DEPLOY.md).");
    const sender = parseFrom(env.MAIL_FROM);
    if (!sender) throw new Error("MAIL_FROM must look like no-reply@example.org or Name <no-reply@example.org>.");
    const res = await (opts.fetch ?? fetch)("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ sender, to: [{ email: msg.to }], subject: msg.subject, textContent: msg.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Mail provider rejected the message (HTTP ${res.status}).`);
    const body = (await res.json().catch(() => null)) as { messageId?: string } | null;
    return { delivered: "brevo", id: body?.messageId ?? null };
  }

  if (provider === "sink") {
    const dir = env.MAIL_SINK_DIR;
    if (!dir) throw new Error("MAIL_PROVIDER=sink needs MAIL_SINK_DIR.");
    const abs = resolve(/*turbopackIgnore: true*/ process.cwd(), dir);
    mkdirSync(/*turbopackIgnore: true*/ abs, { recursive: true });
    const file = join(abs, `${Date.now()}-${msg.to.replace(/[^a-z0-9@.]/gi, "_")}.eml`);
    writeFileSync(/*turbopackIgnore: true*/ file, `To: ${msg.to}\nSubject: ${msg.subject}\nDate: ${new Date().toUTCString()}\n\n${msg.text}\n`);
    return { delivered: "sink", path: file };
  }

  throw new Error("No mail transport configured: set MAIL_PROVIDER=brevo or resend (with its API key and MAIL_FROM) or MAIL_SINK_DIR for the development sink (docs/OPERATIONS.md).");
}
