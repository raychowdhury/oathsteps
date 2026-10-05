"use client";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Screen } from "@/components/Screen";

/** Coach pass: shown exactly as the design proposes it. No checkout exists because no payment provider is configured. */
export default function CoachPage() {
  return (
    <Screen
      title="Interview"
      tab="interview"
      back="/interview"
      showSettings={false}
      actions={
        <>
          <button className="o-btn o-btn-p o-btn-lg o-btn-block" type="button" disabled aria-disabled="true">
            Not available yet
          </button>
          <Link href="/interview" className="o-btn o-btn-g o-btn-block">
            Not now
          </Link>
        </>
      }
    >
      <div className="o-page o-narrow">
        <span className="o-tag o-tag-warn" style={{ alignSelf: "flex-start" }}>
          Pricing experiment · not a live offer
        </span>
        <div className="o-stack-s">
          <h1 className="o-h1">Coach pass</h1>
          <p className="o-h2">$19.99 for 90 days, one-time</p>
          <p className="o-help">No renewal. Ends after 90 days.</p>
        </div>
        <section className="o-card">
          <h2 className="o-h2">Included</h2>
          <ul className="o-stack-s">
            {["6 guided mock interviews", "Voice feedback on up to 300 answers", "Study plan and downloadable summary", "Free extension if rescheduled"].map((t) => (
              <li key={t} className="o-row" style={{ alignItems: "flex-start" }}>
                <Icon name="check" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <p className="o-meta">Proposed limits. A practice aid, not an official assessment.</p>
        </section>
        <section className="o-card o-card-guide">
          <h2 className="o-h2">Always free</h2>
          <p>All practice, mocks, English tasks, journey and checklist.</p>
        </section>
        <div className="o-card o-card-amber" style={{ gap: ".25em" }}>
          <div className="o-strong">Nothing can be bought here</div>
          <div>This page shows a proposal. No payment is collected and nothing is unlocked.</div>
        </div>
      </div>
    </Screen>
  );
}
