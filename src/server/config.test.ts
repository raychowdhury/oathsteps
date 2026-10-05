import { describe, expect, it } from "vitest";
import { assertConfig, checkConfig } from "./config";

const good = { NODE_ENV: "production", BETTER_AUTH_SECRET: "x".repeat(40), BETTER_AUTH_URL: "https://oathsteps.example.org", NEXT_PUBLIC_APP_URL: "https://oathsteps.example.org", MAIL_PROVIDER: "resend", RESEND_API_KEY: "k", MAIL_FROM: "a@b.co", LEGAL_ENTITY: "Example Org", LEGAL_CONTACT_EMAIL: "privacy@example.org" };

describe("production config", () => {
  it("accepts a complete public configuration", () => {
    expect(checkConfig(good)).toEqual({ errors: [], warnings: [] });
    expect(() => assertConfig(good)).not.toThrow();
  });

  it("rejects weak or placeholder secrets", () => {
    expect(checkConfig({ ...good, BETTER_AUTH_SECRET: "short" }).errors[0]).toMatch(/BETTER_AUTH_SECRET/);
    expect(checkConfig({ ...good, BETTER_AUTH_SECRET: "replace-with-32-plus-random-characters" }).errors[0]).toMatch(/BETTER_AUTH_SECRET/);
    expect(checkConfig({ ...good, BETTER_AUTH_SECRET: undefined }).errors[0]).toMatch(/BETTER_AUTH_SECRET/);
  });

  it("requires https on a public address but not on localhost", () => {
    expect(checkConfig({ ...good, BETTER_AUTH_URL: "http://oathsteps.example.org", NEXT_PUBLIC_APP_URL: undefined }).errors.join()).toMatch(/https/);
    expect(checkConfig({ ...good, BETTER_AUTH_URL: "http://127.0.0.1:3100", NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100", MAIL_PROVIDER: undefined, MAIL_SINK_DIR: "x" })).toEqual({ errors: [], warnings: [] });
    expect(checkConfig({ ...good, BETTER_AUTH_URL: "not a url" }).errors.join()).toMatch(/full URL/);
  });

  it("rejects mismatched public origins", () => {
    expect(checkConfig({ ...good, NEXT_PUBLIC_APP_URL: "https://other.example.org" }).errors.join()).toMatch(/same origin/);
  });

  it("fails resend without credentials and warns when a public deployment has no real mail or legal details", () => {
    expect(checkConfig({ ...good, RESEND_API_KEY: undefined }).errors.join()).toMatch(/RESEND_API_KEY/);
    const r = checkConfig({ ...good, MAIL_PROVIDER: undefined, MAIL_SINK_DIR: "/data/mail", LEGAL_ENTITY: undefined });
    expect(r.errors).toEqual([]);
    expect(r.warnings.join()).toMatch(/NOT delivered/);
    expect(r.warnings.join()).toMatch(/LEGAL_ENTITY/);
  });

  it("lets the browser tests turn the auth rate limit off locally but never on a public address", () => {
    expect(checkConfig({ ...good, BETTER_AUTH_URL: "http://127.0.0.1:3100", NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100", AUTH_RATE_LIMIT: "off" }).errors).toEqual([]);
    expect(checkConfig({ ...good, AUTH_RATE_LIMIT: "off" }).errors.join()).toMatch(/AUTH_RATE_LIMIT/);
  });

  it("only throws in production", () => {
    expect(() => assertConfig({ NODE_ENV: "development", BETTER_AUTH_SECRET: "x" })).not.toThrow();
    expect(() => assertConfig({ NODE_ENV: "production", BETTER_AUTH_SECRET: "x" })).toThrow(/Invalid production configuration/);
  });
});
