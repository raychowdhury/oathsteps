import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./prisma";
import { deliverMail } from "./mail";

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
    sendResetPassword: async ({ user, url }) => {
      await deliverMail({ to: user.email, subject: "Reset your OathSteps password", text: `Reset your password: ${url}\n\nIf you did not ask for this, ignore this message.` });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await deliverMail({ to: user.email, subject: "Confirm your OathSteps email", text: `Confirm your email: ${url}` });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: {
    useSecureCookies: baseURL.startsWith("https://"),
  },
  rateLimit: { enabled: true, window: 60, max: 30 },
  trustedOrigins: [baseURL],
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
