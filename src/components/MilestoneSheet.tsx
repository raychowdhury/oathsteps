"use client";
import { useState } from "react";
import { MILESTONES, PENDING_STATES, needsDate, validateMilestone, type Journey, type MilestoneKey } from "@/domain/journey";
import { routeFor } from "@/lib/path";
import { getProfile, saveJourney, saveProfile, setJourneySlot } from "@/lib/store/repo";
import { ErrorLine, Sheet, useToast } from "./Overlay";

export function MilestoneSheet({ slotKey, journey, filing, today, initialStatus, onClose, onSaved }: { slotKey: MilestoneKey; journey: Journey; filing: string | null; today: string; initialStatus?: string; onClose: () => void; onSaved?: () => void }) {
  const { toast } = useToast();
  const def = MILESTONES.find((m) => m.key === slotKey)!;
  const current = slotKey === "filed" ? { status: filing ? "done" : "none", date: filing ?? "" } : journey[slotKey];
  const [status, setStatus] = useState(initialStatus ?? current.status);
  const [date, setDate] = useState(current.date);
  const [err, setErr] = useState("");
  const dateLabel = PENDING_STATES.has(status) ? "Appointment date" : status === "reused" ? "Date of notice (optional)" : "Date";
  const help = slotKey === "filed" ? "This can change your test." : slotKey === "decision" ? "The oath is a separate step." : "Use your notice.";

  const save = async () => {
    const e = validateMilestone({ key: slotKey, status, date }, filing, today);
    if (e) return setErr(e);
    if (slotKey === "filed") {
      const p = await getProfile();
      const prev = { filingDate: p.filingDate, filingDateUnknown: p.filingDateUnknown };
      const next = { filingDate: status === "done" ? date : null, filingDateUnknown: status !== "done" };
      await saveProfile(next);
      toast(`Saved. Study path: ${routeFor({ ...next, specialConsideration: p.specialConsideration }).short}.`, () => saveProfile(prev));
    } else {
      const prevJ = journey;
      await setJourneySlot(slotKey, { status, date: status === "none" ? "" : date || "" });
      toast(`${def.title} saved.`, () => saveJourney(prevJ));
    }
    onSaved?.();
    onClose();
  };

  return (
    <Sheet title={`Edit: ${def.title}`} onClose={onClose}>
      <p className="o-help">{help}</p>
      <div>
        <label className="o-label" htmlFor="ms-status">
          Status
        </label>
        <select
          id="ms-status"
          className="o-input"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setErr("");
          }}
        >
          {def.opts.map((o) => (
            <option key={o[0]} value={o[0]}>
              {o[1]}
            </option>
          ))}
        </select>
      </div>
      {status !== "none" && (
        <div>
          <label className="o-label" htmlFor="ms-date">
            {dateLabel}
          </label>
          <input
            id="ms-date"
            className="o-input"
            type="date"
            value={date}
            aria-invalid={err ? "true" : "false"}
            aria-describedby="ms-err"
            onChange={(e) => {
              setDate(e.target.value);
              setErr("");
            }}
          />
          {err && <ErrorLine id="ms-err">{err}</ErrorLine>}
          {!needsDate(slotKey, status) && <div className="o-meta" style={{ marginTop: ".375em" }}>Optional for a reuse notice.</div>}
        </div>
      )}
      <div className="o-meta">Saved as manually entered.</div>
      <div className="o-actions-2">
        <button className="o-btn o-btn-n" type="button" onClick={onClose}>
          Cancel
        </button>
        <button className="o-btn o-btn-p" type="button" onClick={save} data-testid="save-milestone">
          Save
        </button>
      </div>
    </Sheet>
  );
}
