import { describe, expect, it } from "vitest";
import { releaseChecks, type ContentState } from "./release";

const env = { BETTER_AUTH_SECRET: "x".repeat(40), BETTER_AUTH_URL: "https://study.example.org", NEXT_PUBLIC_APP_URL: "https://study.example.org", MAIL_PROVIDER: "resend", RESEND_API_KEY: "k", MAIL_FROM: "a@b.co", LEGAL_ENTITY: "Example Org", LEGAL_CONTACT_EMAIL: "privacy@example.org", LEGAL_REVIEWED_ON: "2026-11-01" };
const reviewed: ContentState = { packs: [{ id: "civics-2025", humanReviewed: true }, { id: "civics-2008", humanReviewed: true }], guide: true, english: true };
const unreviewed: ContentState = { packs: [{ id: "civics-2025", humanReviewed: false }, { id: "civics-2008", humanReviewed: false }], guide: false, english: false };
const blocked = (c: ReturnType<typeof releaseChecks>) => c.filter((x) => x.status === "blocked").map((x) => x.id);

describe("release checks", () => {
  it("passes when every gate is closed", () => {
    expect(blocked(releaseChecks(env, reviewed))).toEqual([]);
  });

  it("blocks a fresh development setup on every gate", () => {
    expect(blocked(releaseChecks({ BETTER_AUTH_SECRET: "replace-with-32-plus-random-characters", BETTER_AUTH_URL: "http://localhost:3000", MAIL_SINK_DIR: "./data/mail" }, unreviewed))).toEqual(["configuration", "public-address", "mail", "legal-details", "legal-review", "content-civics-2025", "content-civics-2008", "content-guide", "content-english"]);
  });

  it("blocks only what is missing", () => {
    expect(blocked(releaseChecks({ ...env, LEGAL_REVIEWED_ON: undefined }, reviewed))).toEqual(["legal-review"]);
    expect(blocked(releaseChecks(env, { ...reviewed, guide: false }))).toEqual(["content-guide"]);
    expect(blocked(releaseChecks({ ...env, MAIL_PROVIDER: "sink", MAIL_SINK_DIR: "x" }, reviewed))).toEqual(["mail"]);
  });
});
