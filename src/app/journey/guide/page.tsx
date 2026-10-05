"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { ChecklistEntry } from "@/domain/types";
import { fmtDate } from "@/domain/validation";
import { guide, sourceFor, type GuideItem } from "@/lib/guide";
import { getProfile, listChecklist, setChecklist } from "@/lib/store/repo";
import { nowIso } from "@/lib/store/events";
import { useData } from "@/lib/store/useData";
import { FilingSheet } from "@/components/FilingSheet";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Overlay";
import { ExtLink, Screen } from "@/components/Screen";

function GuideInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { data: profile } = useData(getProfile);
  const { data: checklist } = useData(listChecklist);
  const [open, setOpen] = useState<Set<string>>(() => new Set(params.get("open") ? [params.get("open")!] : []));
  const [sheet, setSheet] = useState<"filing" | null>(null);
  // Checkboxes and switches reflect a change immediately; the store write follows.
  const [draft, setDraft] = useState<Record<string, ChecklistEntry>>({});
  if (!profile || !checklist) return null;
  const byId = new Map(checklist.map((c) => [c.itemId, c]));
  for (const [k, v] of Object.entries(draft)) byId.set(k, v);
  const write = (entry: ChecklistEntry) => {
    setDraft((d) => ({ ...d, [entry.itemId]: entry }));
    return setChecklist(entry);
  };

  const toggleDone = async (t: GuideItem) => {
    const cur = byId.get(t.id);
    const was = Boolean(cur?.completedAt);
    const remind = cur?.remind ?? false;
    await write({ itemId: t.id, completedAt: was ? null : nowIso(), remind });
    if (!was) toast(`Marked done: ${t.text}`, () => write({ itemId: t.id, completedAt: null, remind }));
  };
  const toggleRemind = async (t: GuideItem) => {
    const cur = byId.get(t.id);
    const next = !cur?.remind;
    await write({ itemId: t.id, completedAt: cur?.completedAt ?? null, remind: next });
    if (next && !profile.reminders.study) toast("Reminder saved. Study reminders are off in Settings, so it won’t show until you turn them on.");
    else if (next) toast("Reminder saved for this step (study reminder).");
  };
  const act = (t: GuideItem) => {
    if (t.action === "filing") setSheet("filing");
    else if (t.action === "settings") router.push("/settings");
    else if (t.action === "journey") router.push("/journey");
  };

  return (
    <Screen title="Journey" tab="journey" back="/journey" showSettings={false}>
      <div className="o-page">
        <div className="o-stack-s">
          <h1 className="o-h1">Preparation guide</h1>
          <p className="o-help">Your notices always come first.</p>
        </div>
        <div className="o-cols">
          <div className="o-stack">
            {guide.stages.map((stage) => {
              const doneCount = stage.items.filter((t) => byId.get(t.id)?.completedAt).length;
              return (
                <section key={stage.id} className="o-card" style={{ gap: 0 }} aria-labelledby={`stage-${stage.id}`}>
                  <div className="o-sec-h" style={{ marginBottom: ".5em" }}>
                    <h2 id={`stage-${stage.id}`} className="o-h2">
                      {stage.title}
                    </h2>
                    <span className="o-meta">
                      {doneCount} of {stage.items.length} done
                    </span>
                  </div>
                  {stage.items.map((t) => {
                    const entry = byId.get(t.id);
                    const isDone = Boolean(entry?.completedAt);
                    const isOpen = open.has(t.id);
                    return (
                      <div key={t.id} id={t.id} style={{ borderTop: "1px solid var(--line)", padding: ".25em 0" }} data-testid={`task-${t.id}`}>
                        <div className="o-row" style={{ alignItems: "flex-start" }}>
                          <label className="o-check o-grow">
                            <input type="checkbox" checked={isDone} onChange={() => toggleDone(t)} />
                            <span style={isDone ? { color: "var(--mut)", textDecoration: "line-through" } : undefined}>{t.text}</span>
                          </label>
                          <button
                            className="o-iconbtn"
                            type="button"
                            aria-expanded={isOpen}
                            aria-label={`${isOpen ? "Hide" : "Show"} details: ${t.text}`}
                            onClick={() => {
                              const n = new Set(open);
                              if (n.has(t.id)) n.delete(t.id);
                              else n.add(t.id);
                              setOpen(n);
                            }}
                          >
                            <Icon name="chevronDown" style={isOpen ? { transform: "rotate(180deg)" } : undefined} />
                          </button>
                        </div>
                        {isOpen && (
                          <div className="o-stack-s o-reveal" style={{ padding: "0 0 .75em 2.125em" }}>
                            <p>{t.why}</p>
                            {t.action && (
                              <button className="o-btn o-btn-s" type="button" onClick={() => act(t)} style={{ alignSelf: "flex-start" }}>
                                {t.actionLabel}
                              </button>
                            )}
                            {t.links.map((k) => {
                              const src = sourceFor(k);
                              return src ? (
                                <ExtLink key={k} href={src.url}>
                                  {src.label}
                                </ExtLink>
                              ) : null;
                            })}
                            <label className="o-switch">
                              <input type="checkbox" role="switch" checked={Boolean(entry?.remind)} onChange={() => toggleRemind(t)} />
                              <span className="o-switch-ui" />
                              <span>Remind me</span>
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </section>
              );
            })}
          </div>
          <div className="o-stack">
            <div className="o-card o-card-amber">
              <div className="o-strong">About this guide</div>
              <div>
                {guide.review.humanReviewed ? `Reviewed${guide.review.humanReviewedAt ? ` ${fmtDate(guide.review.humanReviewedAt)}` : ""}${guide.review.reviewerCredential ? ` by ${guide.review.reviewerCredential}` : ""}.` : "Draft, not expert-reviewed."} Sources checked {fmtDate(guide.review.reviewedAt)}.
              </div>
            </div>
            <div className="o-card o-card-guide">
              <div className="o-strong">Questions about your own case?</div>
              <div>Ask an immigration attorney or accredited representative.</div>
            </div>
            <Link href="/journey" className="o-btn o-btn-g" style={{ alignSelf: "flex-start" }}>
              Back to your journey
            </Link>
          </div>
        </div>
      </div>
      {sheet === "filing" && <FilingSheet profile={profile} onClose={() => setSheet(null)} />}
    </Screen>
  );
}

export default function GuidePage() {
  return (
    <Suspense fallback={null}>
      <GuideInner />
    </Suspense>
  );
}
