"use client";
import { useState, useSyncExternalStore } from "react";
import { needsHomeScreenTip, runningStandalone } from "@/lib/install";

const KEY = "oathsteps:install-tip-dismissed";
const noop = () => () => {};
function snapshot(): boolean {
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(KEY) === "1";
  } catch {
    /* storage blocked: show the tip */
  }
  return !dismissed && needsHomeScreenTip(navigator.userAgent, runningStandalone(), navigator.maxTouchPoints ?? 0);
}

/**
 * iPhone/iPad Safari only. Tested on iOS 26.5: the Home Screen app gets its own storage and starts empty, so the tip says
 * so, and points to an account (sign up in Safari, sign in from the app) as the way to carry progress over.
 */
export function InstallTip({ before = false }: { before?: boolean }) {
  const show = useSyncExternalStore(noop, snapshot, () => false);
  const [hidden, setHidden] = useState(false);
  if (!show || hidden) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* best effort */
    }
    setHidden(true);
  };
  const how = "Tap Share (on newer iPhones it is under the ⋯ button), then Add to Home Screen.";
  return (
    <div className="o-card o-card-guide" data-testid="install-tip">
      <div className="o-strong">{before ? "On iPhone or iPad? Add OathSteps to your Home Screen first" : "Keep your progress on this device"}</div>
      <div>Safari can clear saved progress if you don’t open OathSteps for about a week. The Home Screen app keeps it.</div>
      <div>{how}</div>
      <div className="o-meta">
        {before
          ? "Do it before you start: progress made in Safari does not move to the Home Screen app."
          : "The Home Screen app starts empty. To bring your progress along, create a free account in Settings here, then sign in from the app."}
      </div>
      <button className="o-btn o-btn-s" type="button" onClick={dismiss} style={{ alignSelf: "flex-start" }}>
        Got it
      </button>
    </div>
  );
}
