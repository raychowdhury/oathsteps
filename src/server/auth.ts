import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./prisma";
import { deliverMail, type MailMessage } from "./mail";

/** Not awaited: a slow or failing provider must not block or break sign-up, and response time must not reveal whether an address exists. Failures are logged without the address. */
const send = (msg: MailMessage) => {
  void deliverMail(msg).catch((e: Error) => console.error(`[mail] not delivered: ${e.message}`));
};

const baseURL = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  appName: "OathSteps",
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    // Verification is optional for study; the flow exists and is testable through the dev mail sink.
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      send({ to: user.email, subject: "Reset your OathSteps password", text: `Reset your password: ${url}\n\nThis link works for one hour. If you did not ask for this, ignore this message and your password stays the same.\n\nOathSteps is a private study tool, not affiliated with USCIS.` });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      send({ to: user.email, subject: "Confirm your OathSteps email", text: `Confirm your email: ${url}\n\nIf you did not create an OathSteps account, ignore this message.\n\nOathSteps is a private study tool, not affiliated with USCIS.` });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: {
    useSecureCookies: baseURL.startsWith("https://"),
    // Rate limits are per client IP. Behind Caddy the default x-forwarded-for is right. Behind a Cloudflare Tunnel set
    // TRUSTED_IP_HEADER=cf-connecting-ip, and only when the tunnel is the app's sole entrance (anyone can forge the header otherwise).
    ...(process.env.TRUSTED_IP_HEADER ? { ipAddress: { ipAddressHeaders: [process.env.TRUSTED_IP_HEADER.trim().toLowerCase()] } } : {}),
  },
  // On everywhere. Only the browser tests turn it off, and checkConfig refuses that on a public address.
  rateLimit: { enabled: process.env.AUTH_RATE_LIMIT !== "off", window: 60, max: 30 },
  trustedOrigins: [baseURL],
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
