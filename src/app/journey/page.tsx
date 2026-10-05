"use client";
import Link from "next/link";
import { useState } from "react";
import { appointmentReminders, buildIcs, DONE_STATES, MILESTONES, NOTED_STATES, PENDING_STATES, slotFor, statusLabel, upNext, type MilestoneKey } from "@/domain/journey";
import { fmtDate } from "@/domain/validation";
import { allGuideItems, guideItem } from "@/lib/guide";
import { listChecklist } from "@/lib/store/repo";
import { useData } from "@/lib/store/useData";
import { loadSnapshot } from "@/lib/today";
import { Icon, type IconName } from "@/components/icons";
import { MilestoneSheet } from "@/components/MilestoneSheet";
import { Screen } from "@/components/Screen";

export default function JourneyPage() {
  const { data: s } = useData(loadSnapshot);
  const { data: checklist } = useData(listChecklist);
  const [editing, setEditing] = useState<MilestoneKey | null>(null);
  if (!s || !checklist) return null;
  const filing = s.profile.filingDate;
  const done = new Set(checklist.filter((c) => c.completedAt).map((c) => c.itemId));
  const guideDone = allGuideItems.filter((i) => done.has(i.id)).length;
  const reminders = [
    ...(s.profile.reminders.appointments ? appointmentReminders(s.journey, s.today) : []),
    ...(s.profile.reminders.study ? checklist.filter((c) => c.remind && !c.completedAt).map((c) => ({ id: `task:${c.itemId}`, category: "study" as const, title: guideItem(c.itemId)?.text ?? "Guide task", date: s.today })) : []),
  ];
  const exportIcs = () => {
    const events = (["bio", "interview", "oath"] as const).filter((k) => PENDING_STATES.has(s.journey[k].status) && s.journey[k].date).map((k) => ({ uid: `${k}-${s.journey[k].date}`, date: s.journey[k].date, summary: `${MILESTONES.find((m) => m.key === k)!.title} (OathSteps)`, description: "Date entered by you. Confirm the time and location on your USCIS notice." }));
    const blob = new Blob([buildIcs(events)], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "oathsteps-appointments.ics";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Screen title="OathSteps" tab="journey" demo={s.demo}>
      <div className="o-page">
        <div className="o-stack-s">
          <h1 className="o-h1">Your journey</h1>
          <p className="o-help">Dates you enter. Not connected to USCIS.</p>
        </div>
        <div className="o-cols">
          <section className="o-card">
            <div className="o-sec-h">
              <h2 className="o-h2">Milestones</h2>
              <span className="o-meta">Entered by you</span>
            </div>
            <ol className="o-tl" data-testid="milestones">
              {MILESTONES.map((m) => {
                const val = slotFor(s.journey, m.key, filing);
                const label = statusLabel(m.key, val.status);
                const isDone = DONE_STATES.has(val.status);
                const pend = PENDING_STATES.has(val.status);
                const noted = NOTED_STATES.has(val.status);
                const dateText = val.date ? `${fmtDate(val.date)} · Manually entered` : val.status === "reused" ? "No appointment · Manually entered" : "No date entered";
                const note = m.key === "filed" && val.date ? `Sets your test: ${s.route.short}.` : m.key === "outcome" && val.status === "retest" ? "Usually 60–90 days later." : "";
                const icon: IconName | null = isDone ? "check" : pend ? "calendar" : noted ? "note" : null;
                return (
                  <li key={m.key} className="o-tl-item" data-testid={`ms-${m.key}`}>
                    <span className={`o-node ${isDone ? "o-node-done" : pend ? "o-node-pend" : noted ? "o-node-note" : ""}`}>{icon && <Icon name={icon} />}</span>
                    <div className="o-row-between">
                      <div className="o-grow">
                        <div className="o-strong">{m.title}</div>
                        <div className="o-meta" style={{ marginTop: ".125em" }}>
                          <span style={{ fontWeight: 600, color: isDone ? "var(--fo)" : pend ? "var(--tls)" : noted ? "var(--am)" : "var(--mut)" }}>{label}</span> · {dateText}
                        </div>
                        {note && (
                          <div className="o-meta" style={{ marginTop: ".25em" }}>
                            {note}
                          </div>
                        )}
                      </div>
                      <button className="o-btn o-btn-g" type="button" onClick={() => setEditing(m.key)} aria-label={`Edit ${m.title}`}>
                        Edit
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="o-meta">Approval and the oath are separate steps.</p>
          </section>
          <div className="o-stack">
            <Link href="/journey/guide" className="o-card o-card-guide o-card-btn" style={{ textDecoration: "none" }}>
              <span className="o-ic-tile" style={{ background: "var(--sf)" }}>
                <Icon name="guide" />
              </span>
              <span className="o-grow">
                <span className="o-h2" style={{ display: "block" }}>
                  Preparation guide
                </span>
                <span className="o-meta">
                  {guideDone} of {allGuideItems.length} done
                </span>
              </span>
              <Icon name="chevronRight" />
            </Link>
            <section className="o-card">
              <h2 className="o-h2">Coming up</h2>
              {upNext(s.journey, filing, s.today).map((u) => (
                <div key={u.t} className="o-row" style={{ alignItems: "flex-start" }}>
                  <Icon name="chevronRight" style={{ color: "var(--tls)" }} />
                  <div className="o-grow">{u.t}</div>
                </div>
              ))}
            </section>
            <section className="o-card">
              <div className="o-sec-h">
                <h2 className="o-h2">Reminders</h2>
                <button className="o-btn o-btn-g" type="button" onClick={exportIcs} data-testid="export-ics">
                  Add to calendar
                </button>
              </div>
              {reminders.length === 0 ? (
                <p className="o-help">Nothing due today. Reminders show here and on Today when you open the app.</p>
              ) : (
                <div className="o-list">
                  {reminders.map((r) => (
                    <div key={r.id} className="o-li">
                      <span className={`o-tag ${r.category === "appointments" ? "o-tag-t" : "o-tag-n"}`}>{r.category === "appointments" ? "Appointment" : "Study"}</span>
                      <div className="o-grow">{r.title}</div>
                    </div>
                  ))}
                </div>
              )}
              <p className="o-meta">In-app only. The calendar file carries your scheduled dates.</p>
            </section>
            <div className="o-card o-card-plain" style={{ gap: ".25em" }}>
              <div className="o-strong">Case status updates</div>
              <div className="o-help">Later. Needs approved USCIS access.</div>
            </div>
          </div>
        </div>
      </div>
      {editing && <MilestoneSheet slotKey={editing} journey={s.journey} filing={filing} today={s.today} onClose={() => setEditing(null)} />}
    </Screen>
  );
}
