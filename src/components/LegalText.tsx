import type { ReactNode } from "react";
import { fmtDate } from "@/domain/validation";
import type { LegalInfo } from "@/server/legal";

/**
 * The Privacy notice and Terms text. Plain React with no Next.js imports, so the app pages (Legal.tsx) and the
 * GitHub Pages build (scripts/build-legal-site.tsx) render exactly the same words.
 */

/** Bump when the text changes in a way readers should know about. */
export const LEGAL_UPDATED = "2026-10-05";

export interface LegalHrefs {
  privacy: string;
  terms: string;
}
export const APP_HREFS: LegalHrefs = { privacy: "/privacy", terms: "/terms" };

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children} <span className="o-meta">(opens in a new tab)</span>
    </a>
  );
}

export function LegalIntro({ title, legal }: { title: string; legal: LegalInfo }) {
  return (
    <>
      <div className="o-stack-s">
        <h1 className="o-h1">{title}</h1>
        <p className="o-meta">Last updated {fmtDate(LEGAL_UPDATED)}</p>
      </div>
      {legal.reviewedOn ? (
        <div className="o-card o-card-ok" role="note" data-testid="legal-reviewed">
          <div>Reviewed by a lawyer on {fmtDate(legal.reviewedOn)}.</div>
        </div>
      ) : (
        <div className="o-card o-card-amber" role="note" data-testid="legal-draft">
          <div className="o-strong">Draft</div>
          <div>This text has not been reviewed by a lawyer yet. It describes what the app does today.</div>
        </div>
      )}
    </>
  );
}

export function ContactSection({ legal }: { legal: LegalInfo }) {
  return (
    <section className="o-card o-stack-s">
      <h2 className="o-h2">Contact</h2>
      <p>
        {legal.contactEmail && <a href={`mailto:${legal.contactEmail}`}>{legal.contactEmail}</a>}
        {legal.contactEmail && legal.contactUrl && " · "}
        {legal.contactUrl && <a href={legal.contactUrl}>{legal.contactUrl}</a>}
        {!legal.contactEmail && !legal.contactUrl && "The operator has not published a contact address on this server yet."}
      </p>
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="o-card o-stack-s">
      <h2 className="o-h2">{title}</h2>
      {children}
    </section>
  );
}

const operator = (legal: LegalInfo) => legal.entity ?? "The operator of this server (not yet named)";

export function PrivacySections({ legal }: { legal: LegalInfo }) {
  return (
    <>
      <Section title="The short version">
        <ul className="o-bullets">
          <li>You can study without an account. Then your study data stays on this device.</li>
          <li>We never ask for your Social Security number, A-Number, USCIS password, ID documents or answers to the N-400.</li>
          <li>No ads. No analytics. No tracking across other sites.</li>
          <li>You can export or delete your data in Settings at any time.</li>
        </ul>
      </Section>
      <Section title="Who runs OathSteps">
        <p>{operator(legal)} runs OathSteps. OathSteps is a private study tool. It is not affiliated with USCIS.</p>
      </Section>
      <Section title="What stays on your device">
        <p>These are saved in your browser’s storage on this device:</p>
        <ul className="o-bullets">
          <li>Your settings, such as text size and theme.</li>
          <li>Your filing date and your state, if you enter them. Both are optional.</li>
          <li>Which questions you practiced, how it went, and when.</li>
          <li>Questions you saved, and your mock test results.</li>
          <li>Interview and appointment dates you enter, and your checklist progress.</li>
          <li>Sentences you write in writing practice.</li>
          <li>Answers you confirmed for questions whose answers depend on where you live.</li>
          <li>Issue reports you write about a question.</li>
        </ul>
        <p>This data leaves your device only if you create an account and agree to sync. Settings, then Delete all data, removes it. Clearing your browser’s site data removes it too. Some browsers also delete site data you have not used for a while.</p>
        <p>The app keeps a copy of itself and the question lists on your device so it works offline. That copy has no personal information.</p>
      </Section>
      <Section title="If you create an account">
        <ul className="o-bullets">
          <li>We store your email and the name you give.</li>
          <li>We store your password only as a one-way hash.</li>
          <li>We store your sign-in sessions, including the IP address and browser type used to sign in. We use them to keep your account safe.</li>
          <li>If you agree to sync, we store copies of the study data listed above, linked to your account, and a record of when you agreed.</li>
        </ul>
        <p>Sync is off until you agree. Account, then Delete my account, removes your account, sessions and synced data right away. Backup copies are deleted when old backups are rotated.</p>
      </Section>
      <Section title="Email">
        <p>
          We send email only to confirm your address and to reset your password. We use {legal.mailProvider ?? "an email delivery service"} to send it. It receives your email address and the message. We do not send marketing email.
        </p>
      </Section>
      <Section title="Voice practice">
        <p>If you tap Say your answer, your browser’s speech recognition turns your voice into text. Depending on your browser, your voice may be sent to the company that makes it, for example Google for Chrome. OathSteps does not record or keep your audio or the text it hears.</p>
        <p>You can type your answer or check yourself instead. Read-aloud uses your device’s voices. Some browsers use online voices.</p>
      </Section>
      <Section title="Cookies and storage">
        <p>OathSteps sets one cookie, only when you sign in. It keeps you signed in. We use no advertising or analytics cookies. We use your browser’s storage and a service worker, a small helper that lets the app work offline.</p>
      </Section>
      <Section title="Server records">
        <p>The server keeps the account data above and basic error logs. The logs do not contain your study data, emails or passwords. Our hosting service or server software may keep ordinary connection logs, such as your IP address and the time, to keep the service secure and to fix problems.</p>
      </Section>
      <Section title="Who gets your information">
        <p>We do not sell it. We do not share it for advertising. It goes to our email service, for the messages above, and to our hosting provider, which stores the data. We may share information if the law requires it.</p>
      </Section>
      <Section title="Your choices">
        <ul className="o-bullets">
          <li>Export your data: Settings, then Export.</li>
          <li>Delete the data on this device: Settings, then Delete all data.</li>
          <li>Delete your account and synced data: Account, then Delete my account.</li>
          <li>Change an answer or date: edit it in the app.</li>
        </ul>
        <p>Depending on where you live, the law may give you more rights, such as asking for a copy of your data or for a correction. Contact us and we will answer.</p>
      </Section>
      <Section title="Children">
        <p>OathSteps is for adults. It is not meant for children under 13. If you believe a child gave us information, contact us and we will delete it.</p>
      </Section>
      <Section title="Keeping data safe">
        <p>Connections use HTTPS. Passwords are hashed. Sign-in attempts are rate limited. No system is perfectly secure, so please do not enter information the app does not ask for.</p>
      </Section>
      <Section title="Changes">
        <p>If this notice changes in an important way, we will say so in the app. The date at the top shows the latest update.</p>
      </Section>
    </>
  );
}

export function TermsSections({ legal, hrefs = APP_HREFS }: { legal: LegalInfo; hrefs?: LegalHrefs }) {
  return (
    <>
      <Section title="Using OathSteps">
        <p>{operator(legal)} runs OathSteps. By using it you accept these terms and the <a href={hrefs.privacy}>Privacy notice</a>. If you do not accept them, please do not use it.</p>
      </Section>
      <Section title="What OathSteps is">
        <p>OathSteps helps you study for the U.S. naturalization civics test and interview. It is a private study tool.</p>
        <ul className="o-bullets">
          <li>It is not part of USCIS, DHS or any government agency, and no agency endorses it.</li>
          <li>It is not a law firm. It does not give legal advice, and using it does not create an attorney-client relationship.</li>
          <li>It does not prepare or file forms, and it does not decide whether you are eligible.</li>
          <li>Practice results do not predict what will happen at your interview.</li>
        </ul>
        <p>
          For questions about your own case, talk to a licensed immigration attorney or a DOJ-accredited representative. USCIS explains how to find one: <Ext href="https://www.uscis.gov/avoid-scams/find-legal-services">Find legal services at USCIS</Ext>.
        </p>
      </Section>
      <Section title="Accuracy">
        <p>The civics questions and answers come from lists published by USCIS. The test and its rules can change. Some answers depend on where you live or who holds an office. OathSteps does not guess those. Confirm them on an official site before your interview.</p>
        <p>Your interview officer decides what is asked. Parts of OathSteps were written by us, not by USCIS, and may not have been reviewed by an expert. The Settings screen shows the review status of each part.</p>
      </Section>
      <Section title="Your responsibilities">
        <ul className="o-bullets">
          <li>Use OathSteps for your own study.</li>
          <li>Do not enter your Social Security number, A-Number, USCIS password, ID documents or N-400 answers.</li>
          <li>Keep your password private.</li>
          <li>Check the dates you enter. You are responsible for them.</li>
          <li>Do not try to break, overload or misuse the service.</li>
        </ul>
      </Section>
      <Section title="Accounts">
        <p>An account is optional. You can delete it at any time in the app. We may suspend an account that harms the service or other people.</p>
      </Section>
      <Section title="The service">
        <p>OathSteps is provided as is. It may be unavailable, and it may change. Export your data from Settings if you want your own copy.</p>
      </Section>
      <Section title="No promises, and limits on responsibility">
        <p>We do not promise that OathSteps is complete, current or free of errors. As far as the law allows, we are not responsible for the outcome of your application or interview, or for losses from relying on OathSteps. Nothing in these terms limits rights that the law does not allow to be limited.</p>
      </Section>
      <Section title="Changes">
        <p>We may update these terms. If a change is important, we will tell you in the app. Using OathSteps after a change means you accept it.</p>
      </Section>
      <Section title="Governing law">
        <p>{legal.jurisdiction ? `These terms are governed by the laws of ${legal.jurisdiction}.` : "These terms are governed by the laws of the place where the operator is based."}</p>
      </Section>
    </>
  );
}
