"use client";
import Link from "next/link";
import { InstallTip } from "./InstallTip";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { todayDateOnly } from "@/domain/dates";
import { loadDemoLearner } from "@/lib/demo";
import { Icon } from "./icons";
import { useToast } from "./Overlay";

export function Welcome() {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const demo = async () => {
    setBusy(true);
    await loadDemoLearner(todayDateOnly());
    toast("Loaded a returning learner with illustrative, fictional history.");
    router.push("/");
  };
  return (
    <div className="o-shell">
      <div className="o-main">
        <div className="o-page o-narrow" style={{ justifyContent: "center", gap: "1.5em" }}>
          <div className="o-row-between">
            <span className="o-hero-mark">
              <Icon name="logo" />
            </span>
          </div>
          <div className="o-stack-s">
            <h1 className="o-h1" style={{ fontSize: "1.875em" }}>
              OathSteps
            </h1>
            <p className="o-h2" style={{ color: "var(--tls)" }}>
              Practice. Prepare. Track your journey.
            </p>
            <p className="o-help">Study for your citizenship interview. Not affiliated with USCIS.</p>
          </div>
          <ul className="o-stack">
            <li className="o-row" style={{ alignItems: "flex-start", gap: ".75em" }}>
              <span className="o-ic-tile">
                <Icon name="today" />
              </span>
              <div>
                <div className="o-strong">A short daily plan</div>
                <div className="o-help">About 10 minutes</div>
              </div>
            </li>
            <li className="o-row" style={{ alignItems: "flex-start", gap: ".75em" }}>
              <span className="o-ic-tile">
                <Icon name="interview" />
              </span>
              <div>
                <div className="o-strong">Practice like the interview</div>
                <div className="o-help">Answer aloud, from memory</div>
              </div>
            </li>
            <li className="o-row" style={{ alignItems: "flex-start", gap: ".75em" }}>
              <span className="o-ic-tile">
                <Icon name="journey" />
              </span>
              <div>
                <div className="o-strong">Track your steps</div>
                <div className="o-help">Your dates and checklist</div>
              </div>
            </li>
          </ul>
          <div className="o-card o-card-guide" style={{ gap: ".375em" }}>
            <div className="o-row o-strong">
              <Icon name="lock" />
              No account needed
            </div>
            <div>We never ask for your SSN, A-Number, ID or USCIS password.</div>
          </div>
          <InstallTip before />
          <p className="o-meta">
            <Link href="/privacy">Privacy notice</Link> · <Link href="/terms">Terms of use</Link>
          </p>
        </div>
        <div className="o-actions">
          <Link href="/setup" className="o-btn o-btn-p o-btn-lg o-btn-block" data-testid="start-setup">
            Start studying
          </Link>
          <button className="o-btn o-btn-g o-btn-block" type="button" onClick={demo} disabled={busy} data-testid="load-demo">
            Explore with a demo learner’s history
          </button>
        </div>
      </div>
    </div>
  );
}
