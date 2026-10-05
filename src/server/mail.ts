import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Mail delivery. This release ships only a development sink: each message is written as a file
 * under MAIL_SINK_DIR so verification/reset flows can be exercised and tested locally.
 * Production delivery requires a provider; see docs/OPERATIONS.md. If no sink dir is configured in
 * production, sending fails loudly instead of pretending the mail went out.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export async function deliverMail(msg: MailMessage): Promise<{ delivered: "sink"; path: string }> {
  const dir = process.env.MAIL_SINK_DIR;
  if (!dir) throw new Error("No mail transport configured: set MAIL_SINK_DIR for the development sink or configure a provider (docs/OPERATIONS.md).");
  const abs = resolve(/*turbopackIgnore: true*/ process.cwd(), dir);
  mkdirSync(/*turbopackIgnore: true*/ abs, { recursive: true });
  const file = join(abs, `${Date.now()}-${msg.to.replace(/[^a-z0-9@.]/gi, "_")}.eml`);
  writeFileSync(/*turbopackIgnore: true*/ file, `To: ${msg.to}\nSubject: ${msg.subject}\nDate: ${new Date().toUTCString()}\n\n${msg.text}\n`);
  return { delivered: "sink", path: file };
}
