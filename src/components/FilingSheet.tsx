"use client";
import { useState } from "react";
import { todayDateOnly } from "@/domain/dates";
import type { StudyProfile } from "@/domain/types";
import { validateFiling } from "@/domain/validation";
import { routeFor } from "@/lib/path";
import { saveProfile, setChecklist } from "@/lib/store/repo";
import { Icon } from "./icons";
import { ErrorLine, Sheet, useToast } from "./Overlay";

/** "Filing date and test" sheet: edits the filing date, 'not sure' and the 65/20 choice in place. */
export function FilingSheet({ profile, onClose }: { profile: StudyProfile; onClose: () => void }) {
  const { toast } = useToast();
  const today = todayDateOnly();
  const [fd, setFd] = useState({ date: profile.filingDate ?? "", unsure: profile.filingDateUnknown, s6520: profile.specialConsideration, error: "" });
  const preview = routeFor({ filingDate: !fd.unsure && !validateFiling(fd, today) ? fd.date : null, filingDateUnknown: fd.unsure, specialConsideration: fd.s6520 });
  const save = async () => {
    const err = validateFiling(fd, today);
    if (err) return setFd({ ...fd, error: err });
    const before = routeFor({ filingDate: profile.filingDate, filingDateUnknown: profile.filingDateUnknown, specialConsideration: profile.specialConsideration }).short;
    const prev = { filingDate: profile.filingDate, filingDateUnknown: profile.filingDateUnknown, specialConsideration: profile.specialConsideration };
    await saveProfile({ filingDate: fd.unsure ? null : fd.date, filingDateUnknown: fd.unsure, specialConsideration: fd.s6520 });
    if (!fd.unsure && fd.date) await setChecklist({ itemId: "path", completedAt: new Date().toISOString(), remind: false });
    const after = preview.short;
    toast(before === after ? `Saved. Your test stays: ${after}.` : `Study path changed to: ${after}.`, () => saveProfile(prev));
    onClose();
  };
  return (
    <Sheet title="Filing date and test" onClose={onClose}>
      <p className="o-help">It decides your test. See your receipt notice.</p>
      <div>
        <label className="o-label" htmlFor="sh-fd">
          N-400 filing date
        </label>
        <input id="sh-fd" className="o-input" type="date" value={fd.date} max={today} disabled={fd.unsure} aria-invalid={fd.error ? "true" : "false"} aria-describedby="sh-fd-err" onChange={(e) => setFd({ ...fd, date: e.target.value, error: "" })} />
        {fd.error && <ErrorLine id="sh-fd-err">{fd.error}</ErrorLine>}
      </div>
      <label className="o-check">
        <input type="checkbox" checked={fd.unsure} onChange={() => setFd({ ...fd, unsure: !fd.unsure, error: "" })} />
        <span>I’m not sure</span>
      </label>
      <label className="o-check">
        <input type="checkbox" checked={fd.s6520} onChange={() => setFd({ ...fd, s6520: !fd.s6520 })} />
        <span>Use the 65/20 format (my choice)</span>
      </label>
      {preview.key !== "none" ? (
        <div className="o-card o-card-guide" style={{ gap: ".25em" }} aria-live="polite">
          <div className="o-strong">{preview.name}</div>
          <ul className="o-stack-xs">
            {preview.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <div className="o-meta">{preview.reason}</div>
        </div>
      ) : (
        <div className="o-card o-card-amber" aria-live="polite">
          No test chosen.
        </div>
      )}
      <div className="o-actions-2">
        <button className="o-btn o-btn-n" type="button" onClick={onClose}>
          Cancel
        </button>
        <button className="o-btn o-btn-p" type="button" onClick={save} data-testid="save-filing">
          Save
        </button>
      </div>
      <span className="o-sr">
        <Icon name="info" />
      </span>
    </Sheet>
  );
}
