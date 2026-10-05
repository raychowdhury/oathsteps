import { describe, expect, it } from "vitest";
import { legalInfo } from "./legal";

describe("legal info from the environment", () => {
  it("is all null by default, which keeps the pages in draft", () => {
    expect(legalInfo({})).toEqual({ entity: null, contactEmail: null, contactUrl: null, jurisdiction: null, mailProvider: null, reviewedOn: null });
  });

  it("reads operator details and names the mail provider only when one is configured", () => {
    const i = legalInfo({ LEGAL_ENTITY: " Example Org ", LEGAL_CONTACT_EMAIL: "privacy@example.org", LEGAL_CONTACT_URL: "https://github.com/o/r/issues", LEGAL_JURISDICTION: "New York, USA", LEGAL_REVIEWED_ON: "2026-11-01", MAIL_PROVIDER: "resend" });
    expect(i).toEqual({ entity: "Example Org", contactEmail: "privacy@example.org", contactUrl: "https://github.com/o/r/issues", jurisdiction: "New York, USA", mailProvider: "Resend", reviewedOn: "2026-11-01" });
    expect(legalInfo({ MAIL_SINK_DIR: "x" }).mailProvider).toBeNull();
    expect(legalInfo({ MAIL_PROVIDER: "brevo" }).mailProvider).toBe("Brevo");
  });

  it("ignores a malformed contact address or review date instead of showing them", () => {
    const i = legalInfo({ LEGAL_CONTACT_EMAIL: "not an email", LEGAL_CONTACT_URL: "http://insecure.example", LEGAL_REVIEWED_ON: "soon" });
    expect(i.contactEmail).toBeNull();
    expect(i.contactUrl).toBeNull();
    expect(i.reviewedOn).toBeNull();
  });
});
