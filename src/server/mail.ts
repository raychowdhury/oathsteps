import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Mail delivery. Two transports:
 *  - `resend`: production. Needs RESEND_API_KEY and MAIL_FROM (an address on a domain verified at the provider).
 *  - `sink`: development and tests. Each message is written as an .eml file under MAIL_SINK_DIR.
 * MAIL_PROVIDER picks one; when unset, the sink is used only if MAIL_SINK_DIR is set. With neither, sending fails
 * loudly instead of pretending the mail went out. Adding another provider is one more branch in `deliverMail`.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export type MailResult = { delivered: "sink"; path: string } | { delivered: "resend"; id: string | null };
export type MailProvider = "resend" | "sink" | "none";

type Env = Record<string, string | undefined>;

export function mailProvider(env: Env = process.env): MailProvider {
  const p = env.MAIL_PROVIDER?.trim().toLowerCase();
  if (p === "resend") return "resend";
  if (p === "sink" || (!p && env.MAIL_SINK_DIR)) return "sink";
  return "none";
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

  if (provider === "sink") {
    const dir = env.MAIL_SINK_DIR;
    if (!dir) throw new Error("MAIL_PROVIDER=sink needs MAIL_SINK_DIR.");
    const abs = resolve(/*turbopackIgnore: true*/ process.cwd(), dir);
    mkdirSync(/*turbopackIgnore: true*/ abs, { recursive: true });
    const file = join(abs, `${Date.now()}-${msg.to.replace(/[^a-z0-9@.]/gi, "_")}.eml`);
    writeFileSync(/*turbopackIgnore: true*/ file, `To: ${msg.to}\nSubject: ${msg.subject}\nDate: ${new Date().toUTCString()}\n\n${msg.text}\n`);
    return { delivered: "sink", path: file };
  }

  throw new Error("No mail transport configured: set MAIL_PROVIDER=resend (with RESEND_API_KEY and MAIL_FROM) or MAIL_SINK_DIR for the development sink (docs/OPERATIONS.md).");
}
