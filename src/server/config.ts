import { mailProvider } from "./mail";

type Env = Record<string, string | undefined>;
export interface ConfigReport {
  errors: string[];
  warnings: string[];
}

const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
export const isLocal = (host: string) => LOCAL.has(host) || host.endsWith(".localhost");

/**
 * Production configuration checks. Errors stop the server from starting (instrumentation.ts); warnings are logged.
 * A local address is exempt from the https and "unfinished" warnings so CI, e2e and local Docker stay quiet.
 */
export function checkConfig(env: Env = process.env): ConfigReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const secret = env.BETTER_AUTH_SECRET ?? "";
  if (secret.length < 32 || /^replace-with/i.test(secret)) errors.push("BETTER_AUTH_SECRET must be set to 32 or more random characters (openssl rand -base64 32).");

  let local = true;
  const rawUrl = env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL ?? "";
  try {
    const u = new URL(rawUrl);
    local = isLocal(u.hostname);
    if (!local && u.protocol !== "https:") errors.push(`BETTER_AUTH_URL must be https for a public address (got ${u.protocol}//${u.host}).`);
    if (env.NEXT_PUBLIC_APP_URL && new URL(env.NEXT_PUBLIC_APP_URL).origin !== u.origin) errors.push("NEXT_PUBLIC_APP_URL and BETTER_AUTH_URL must be the same origin.");
  } catch {
    errors.push("BETTER_AUTH_URL must be a full URL such as https://oathsteps.example.org.");
  }

  const provider = mailProvider(env);
  if (provider === "resend" && (!env.RESEND_API_KEY || !env.MAIL_FROM)) errors.push("MAIL_PROVIDER=resend needs RESEND_API_KEY and MAIL_FROM.");
  if (!local && provider !== "resend") warnings.push("No production mail provider: confirmation and password-reset emails are NOT delivered.");
  if (!local && (!env.LEGAL_ENTITY || !env.LEGAL_CONTACT_EMAIL)) warnings.push("LEGAL_ENTITY and LEGAL_CONTACT_EMAIL are not set: the Privacy and Terms pages show that the operator is not named.");

  return { errors, warnings };
}

export function assertConfig(env: Env = process.env): void {
  if (env.NODE_ENV !== "production") return;
  const { errors, warnings } = checkConfig(env);
  for (const w of warnings) console.warn(`[config] ${w}`);
  if (errors.length) throw new Error(`Invalid production configuration:\n- ${errors.join("\n- ")}`);
}
