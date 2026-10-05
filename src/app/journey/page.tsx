"use client";
import { useState } from "react";
import { isValidDateOnly, todayDateOnly } from "@/domain/dates";
import { dueToday } from "@/domain/scheduler";
import type { Milestone, MilestoneKind } from "@/domain/types";
import { guide } from "@/lib/content";
import { MILESTONE_LABELS, SCHEDULED_KINDS, buildIcs, currentStageId, dueReminders } from "@/lib/journey";
import { bankQuestions, pathFor } from "@/lib/path";
import { deleteMilestone, getProfile, listChecklist, listMilestones, listReviewStates, setChecklist, upsertMilestone } from "@/lib/store/repo";
import { newId, nowIso } from "@/lib/store/events";
import { useData } from "@/lib/store/useData";
import { Button, Card, ExternalLink, Field, Input, LinkButton, Notice, PageTitle, Pill, Select, Spinner } from "@/components/ui";

const KIND_ORDER: MilestoneKind[] = ["filed", "receipt", "biometrics-attended", "biometrics-reused", "interview", "interview-continued", "retest", "evidence-requested", "decision-approved", "decision-denied", "oath"];

export default function JourneyPage() {
  const { data, loading } = useData(async () => {
    const [profile, milestones, checklist, reviewStates] = await Promise.all([getProfile(), listMilestones(), listChecklist(), listReviewStates()]);
    return { profile, milestones, checklist, reviewStates };
  });
  const [editing, setEditing] = useState<Milestone | "new" | null>(null);
  if (loading || !data) return <Spinner />;
  const { profile, milestones, checklist, reviewStates } = data;
  const today = todayDateOnly();
  const stageId = currentStageId(milestones);
  const path = pathFor(profile);
  const bankIds = new Set(bankQuestions(path).map((q) => q.id));
  const hasDue = dueToday(reviewStates.filter((s) => bankIds.has(s.questionId)), today, 1).due.length > 0;
  const reminders = dueReminders({ profile, milestones, checklist, today, hasDueCards: hasDue });
  const byItem = new Map(checklist.map((c) => [c.itemId, c]));

  const exportIcs = () => {
    const events = [
      ...milestones.filter((m) => m.date && SCHEDULED_KINDS.includes(m.kind)).map((m) => ({ uid: m.id, date: m.date!, summary: `${MILESTONE_LABELS[m.kind]} (OathSteps)`, description: "User-entered date. Confirm the time and location on your USCIS notice." })),
      ...checklist.filter((c) => c.reminderOn && !c.completedAt).map((c) => ({ uid: `task-${c.itemId}`, date: c.reminderOn!, summary: guide.stages.flatMap((s) => s.items).find((i) => i.id === c.itemId)?.text ?? "OathSteps task" })),
    ];
    const blob = new Blob([buildIcs(events)], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "oathsteps-reminders.ics";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-5">
      <PageTitle title="Journey" lead="Your own milestones and a stage-by-stage guide. Everything here is entered by you; your USCIS notices are the authority." action={<LinkButton href="/readiness" variant="secondary" size="sm">Readiness</LinkButton>} />

      <Card className="space-y-3" aria-labelledby="ms-h">
        <div className="flex items-center justify-between">
          <h2 id="ms-h" className="text-lg font-semibold">
            Milestones <Pill className="ml-1">entered by you</Pill>
          </h2>
          <Button size="sm" onClick={() => setEditing("new")} data-testid="add-milestone">
            Add
          </Button>
        </div>
        {milestones.length === 0 && <p className="text-ink-2">Nothing recorded yet. Add “N-400 filed” when you have a filing date, then each notice as it arrives.</p>}
        <ol className="space-y-2">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 rounded-xl bg-paper-2 p-3">
              <div>
                <p className="font-semibold">{MILESTONE_LABELS[m.kind]}</p>
                <p className="text-sm text-ink-2">
                  {m.date ?? "date not set"}
                  {m.rescheduledFrom && ` · rescheduled from ${m.rescheduledFrom}`}
                </p>
                {m.note && <p className="text-sm text-ink-3">{m.note}</p>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditing(m)} aria-label={`Edit ${MILESTONE_LABELS[m.kind]}`}>
                Edit
              </Button>
            </li>
          ))}
        </ol>
        {editing && <MilestoneForm initial={editing === "new" ? null : editing} profileFiling={profile.filingDate} onClose={() => setEditing(null)} />}
        <p className="text-sm text-ink-3">Approval and the oath are separate steps: you become a citizen at the oath ceremony. Record alternative outcomes (continued, retest, evidence requested) exactly as your notice says.</p>
      </Card>

      <Card className="space-y-2" aria-labelledby="rem-h">
        <div className="flex items-center justify-between">
          <h2 id="rem-h" className="text-lg font-semibold">
            Reminders
          </h2>
          <Button size="sm" variant="secondary" onClick={exportIcs} data-testid="export-ics">
            Export calendar (.ics)
          </Button>
        </div>
        {reminders.length === 0 ? <p className="text-ink-2">Nothing due. Reminders show here and on Today when the app is open; we do not send notifications in the background.</p> : (
          <ul className="space-y-1">
            {reminders.map((r) => (
              <li key={r.id} className="flex justify-between gap-3">
                <span>
                  <Pill tone="teal" className="mr-2">
                    {r.category}
                  </Pill>
                  {r.title}
                </span>
                <span className="shrink-0 text-sm text-ink-3">{r.date}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section className="space-y-3" aria-labelledby="guide-h">
        <h2 id="guide-h" className="text-lg font-semibold">
          Guide and checklist
        </h2>
        <p className="text-sm text-ink-3">
          Original explanations with official links. Content version {guide.version}, machine-checked {guide.review.reviewedAt}; not yet reviewed by a qualified person. Not legal advice.
        </p>
        {guide.stages.map((stage) => {
          const current = stage.id === stageId;
          const doneCount = stage.items.filter((i) => byItem.get(i.id)?.completedAt).length;
          return (
            <details key={stage.id} open={current} className={`rounded-2xl border bg-white ${current ? "border-teal" : "border-line"}`}>
              <summary className="flex cursor-pointer items-center justify-between gap-2 p-4 font-semibold">
                <span>
                  {stage.title}
                  {current && (
                    <Pill tone="teal" className="ml-2">
                      your stage
                    </Pill>
                  )}
                </span>
                <span className="text-sm font-normal text-ink-3">
                  {doneCount}/{stage.items.length}
                </span>
              </summary>
              <div className="space-y-3 px-4 pb-4">
                <p className="text-ink-2">{stage.summary}</p>
                <ul className="space-y-3">
                  {stage.items.map((item) => {
                    const entry = byItem.get(item.id);
                    const done = Boolean(entry?.completedAt);
                    return (
                      <li key={item.id} id={item.id} className="rounded-xl border border-line p-3">
                        <label className="flex items-start gap-3">
                          <input type="checkbox" className="mt-1 h-5 w-5" checked={done} onChange={(e) => setChecklist({ itemId: item.id, completedAt: e.target.checked ? nowIso() : null, reminderOn: entry?.reminderOn ?? null })} />
                          <span className={done ? "text-ink-3 line-through" : ""}>{item.text}</span>
                        </label>
                        <details className="mt-2 text-sm">
                          <summary className="cursor-pointer text-teal-2">Why and where to check</summary>
                          <p className="mt-1 text-ink-2">{item.why}</p>
                          {item.sources.length > 0 && (
                            <ul className="mt-1 list-disc pl-5">
                              {item.sources.map((s) => (
                                <li key={s.url}>
                                  <ExternalLink href={s.url}>{s.label}</ExternalLink>
                                </li>
                              ))}
                            </ul>
                          )}
                        </details>
                        {!done && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                            <label htmlFor={`rem-${item.id}`} className="text-ink-2">
                              Remind me on
                            </label>
                            <input id={`rem-${item.id}`} type="date" className="min-h-10 rounded-lg border border-line px-2" value={entry?.reminderOn ?? ""} min={today} onChange={(e) => setChecklist({ itemId: item.id, completedAt: null, reminderOn: isValidDateOnly(e.target.value) ? e.target.value : null })} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </details>
          );
        })}
      </section>
    </div>
  );
}

function MilestoneForm({ initial, profileFiling, onClose }: { initial: Milestone | null; profileFiling: string | null; onClose: () => void }) {
  const [kind, setKind] = useState<MilestoneKind>(initial?.kind ?? "filed");
  const [date, setDate] = useState(initial?.date ?? (initial ? "" : profileFiling ?? ""));
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const scheduled = SCHEDULED_KINDS.includes(kind);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (date && !isValidDateOnly(date)) return setError("Enter a full calendar date.");
    if (kind === "biometrics-reused" && !date) {
      // date is optional for a reuse notice
    } else if (!date && kind !== "biometrics-reused") return setError("A date is needed for this milestone (use the date on your notice).");
    const rescheduledFrom = initial && scheduled && initial.date && date && initial.date !== date ? initial.date : initial?.rescheduledFrom ?? null;
    await upsertMilestone({ id: initial?.id ?? newId(), kind, date: date || null, note: note.trim() || undefined, rescheduledFrom });
    onClose();
  };

  return (
    <form onSubmit={save} className="space-y-3 rounded-xl border border-teal/40 bg-teal-soft/30 p-3" aria-label={initial ? "Edit milestone" : "Add milestone"}>
      <Field id="ms-kind" label="Milestone">
        <Select id="ms-kind" value={kind} onChange={(e) => setKind(e.target.value as MilestoneKind)}>
          {KIND_ORDER.map((k) => (
            <option key={k} value={k}>
              {MILESTONE_LABELS[k]}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="ms-date" label={scheduled ? "Scheduled date (from your notice)" : "Date"} hint={kind === "biometrics-reused" ? "Optional for a reuse notice." : undefined}>
        <Input id="ms-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field id="ms-note" label="Note (optional)" hint="Do not enter receipt numbers or other identifiers; a short reminder is enough.">
        <Input id="ms-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
      </Field>
      {error && (
        <Notice tone="bad">
          <p>{error}</p>
        </Notice>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" data-testid="save-milestone">
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {initial && (
          <Button type="button" variant="danger" className="ml-auto" onClick={() => deleteMilestone(initial.id).then(onClose)}>
            Remove
          </Button>
        )}
      </div>
    </form>
  );
}
