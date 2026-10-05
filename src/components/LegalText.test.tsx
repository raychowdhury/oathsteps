import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LegalInfo } from "@/server/legal";
import { ContactSection, LegalIntro, PrivacySections, TermsSections } from "./LegalText";

const none: LegalInfo = { entity: null, contactEmail: null, contactUrl: null, jurisdiction: null, mailProvider: null, reviewedOn: null };
const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("legal text shared by the app and the GitHub Pages build", () => {
  it("says what the app stores, in the words learners and reviewers will read", () => {
    const t = html(<PrivacySections legal={none} />);
    expect(t).toContain("We never ask for your Social Security number, A-Number, USCIS password, ID documents or answers to the N-400.");
    expect(t).toContain("including the IP address and browser type used to sign in");
    expect(t).toContain("your voice may be sent to the company that makes it");
    expect(t).toContain("OathSteps does not record or keep your audio");
    expect(t).toContain("We use no advertising or analytics cookies");
  });

  it("names the mail provider only when one is configured", () => {
    expect(html(<PrivacySections legal={none} />)).toContain("We use an email delivery service to send it.");
    expect(html(<PrivacySections legal={{ ...none, mailProvider: "Brevo" }} />)).toContain("We use Brevo to send it.");
  });

  it("names the operator, or says plainly that none is named", () => {
    expect(html(<PrivacySections legal={{ ...none, entity: "Example Org" }} />)).toContain("Example Org runs OathSteps.");
    expect(html(<PrivacySections legal={none} />)).toContain("The operator of this server (not yet named) runs OathSteps.");
  });

  it("stays marked Draft until a review date is set", () => {
    expect(html(<LegalIntro title="Privacy notice" legal={none} />)).toContain("has not been reviewed by a lawyer yet");
    const reviewed = html(<LegalIntro title="Privacy notice" legal={{ ...none, reviewedOn: "2026-11-01" }} />);
    expect(reviewed).toContain("Reviewed by a lawyer on Nov 1, 2026.");
    expect(reviewed).not.toContain("has not been reviewed");
  });

  it("links the Terms to the privacy page given by the caller and to the official legal-help page", () => {
    const app = html(<TermsSections legal={none} />);
    expect(app).toContain('href="/privacy"');
    const pages = html(<TermsSections legal={none} hrefs={{ privacy: "privacy.html", terms: "terms.html" }} />);
    expect(pages).toContain('href="privacy.html"');
    expect(pages).toContain('href="https://www.uscis.gov/avoid-scams/find-legal-services"');
    expect(pages).toContain('target="_blank"');
    expect(pages).toContain("It does not give legal advice, and using it does not create an attorney-client relationship.");
  });

  it("shows the governing law only as the operator states it", () => {
    expect(html(<TermsSections legal={{ ...none, jurisdiction: "New York, USA" }} />)).toContain("governed by the laws of New York, USA.");
    expect(html(<TermsSections legal={none} />)).toContain("the place where the operator is based");
  });

  it("shows whichever contact routes exist, and admits when there are none", () => {
    expect(html(<ContactSection legal={none} />)).toContain("has not published a contact address");
    expect(html(<ContactSection legal={{ ...none, contactEmail: "p@example.org" }} />)).toContain('href="mailto:p@example.org"');
    const both = html(<ContactSection legal={{ ...none, contactEmail: "p@example.org", contactUrl: "https://github.com/o/r/issues" }} />);
    expect(both).toContain("https://github.com/o/r/issues");
    expect(both).toContain("p@example.org");
  });
});
