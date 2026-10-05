"use client";
import Link from "next/link";
import { useState } from "react";
import { getQuestion, topicsFor } from "@/lib/content";
import { downloadForOffline } from "@/lib/offline";
import { practiceBank } from "@/lib/path";
import { getOpenMock, saveProfile, setMeta } from "@/lib/store/repo";
import { useData } from "@/lib/store/useData";
import { dueIds, loadSnapshot, weakIds } from "@/lib/today";
import { FilingSheet } from "@/components/FilingSheet";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Overlay";
import { Screen } from "@/components/Screen";

export default function PracticePage() {
  const { toast } = useToast();
  const { data: s } = useData(loadSnapshot);
  const { data: open } = useData(getOpenMock);
  const [sheet, setSheet] = useState<"filing" | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ mode?: "recall" | "choice"; autoplay?: boolean }>({});
  if (!s) return null;
  const mode = draft.mode ?? s.profile.mode;
  const autoplay = draft.autoplay ?? s.profile.autoplay;
  const bank = practiceBank(s.route);
  const topics = topicsFor(bank, s.route.special);
  const seen = new Set(s.reviewStates.filter((r) => r.seenCount > 0).map((r) => r.questionId));
  const stateById = new Map(s.reviewStates.map((r) => [r.questionId, r]));
  const due = dueIds(s);
  const weak = weakIds(s);
  const pathTagCls = s.route.key === "none" ? "o-tag-warn" : "o-tag-t";
  const download = async () => {
    setBusy(true);
    const r = await downloadForOffline();
    setBusy(false);
    if (r.ok) {
      await setMeta("offlineDownload", { at: new Date().toISOString(), cached: r.cached });
      toast("Questions and the app were downloaded for offline use. Listening uses your device’s voices.");
    } else toast(r.error);
  };

  return (
    <Screen title="OathSteps" tab="practice" demo={s.demo}>
      <div className="o-page">
        <div className="o-stack-s">
          <h1 className="o-h1">Practice</h1>
          <div className="o-row-wrap">
            <button className={`o-tag ${pathTagCls}`} type="button" onClick={() => setSheet("filing")}>
              {s.route.short}
            </button>
            {s.route.key === "none" && <span className="o-meta">Practicing the 2025 list until you add your filing date</span>}
          </div>
        </div>
        <div className="o-note">
          <Icon name="info" />
          <div>
            <span className="o-strong">Official questions:</span> {s.questions.length} from the USCIS list{s.route.special ? " (65/20 set)" : ""}. Wording and answers are machine-checked, not yet expert-reviewed.
          </div>
        </div>
        {!s.downloaded && (
          <div className="o-card" style={{ flexDirection: "row", alignItems: "center" }}>
            <span className="o-ic-tile">
              <Icon name="download" />
            </span>
            <div className="o-grow">
              <div className="o-strong">Not downloaded for offline use</div>
              <div className="o-meta">Needed to practice without a connection.</div>
            </div>
            <button className="o-btn o-btn-s" type="button" onClick={download} disabled={busy} data-testid="download-offline">
              Download
            </button>
          </div>
        )}
        {open && (
          <div className="o-card o-card-guide" style={{ flexDirection: "row", alignItems: "center" }}>
            <div className="o-grow">
              <div className="o-strong">{open.config.kind === "walkthrough" ? "Walkthrough paused" : "Mock paused"}</div>
              <div className="o-meta">
                Question {open.index + 1} of up to {open.config.rules.asked} · {open.answers.length} answered
              </div>
            </div>
            <Link href={`/practice/mock?kind=${open.config.kind}` as never} className="o-btn o-btn-p">
              Resume
            </Link>
          </div>
        )}
        <div className="o-cols">
          <div className="o-stack">
            <section className="o-card">
              <div className="o-sec-h">
                <h2 className="o-h2">Due for review</h2>
                <span className="o-meta" data-testid="due-count">
                  {due.length} due
                </span>
              </div>
              {due.length > 0 ? (
                <>
                  <p className="o-help">Reviewing after a gap helps answers stick.</p>
                  <Link href="/practice/session?kind=due" className="o-btn o-btn-p" style={{ alignSelf: "flex-start" }}>
                    Review {due.length} now
                  </Link>
                </>
              ) : (
                <p className="o-help">Nothing due right now.</p>
              )}
            </section>
            <section className="o-card">
              <h2 className="o-h2">Topics</h2>
              <div className="o-list">
                {topics.map((t) => {
                  const seenCount = t.questionIds.filter((id) => seen.has(id)).length;
                  return (
                    <Link key={t.subsection} href={{ pathname: "/practice/session", query: { kind: "topic", topic: t.subsection } }} className="o-libtn">
                      <span className="o-grow">
                        <span className="o-strong" style={{ display: "block" }}>
                          {t.subsection}
                        </span>
                        <span className="o-meta">
                          Seen {seenCount} of {t.questionIds.length} questions
                        </span>
                      </span>
                      <span className="o-steps" aria-hidden="true" style={{ flex: "none" }}>
                        {Array.from({ length: 6 }, (_, k) => {
                          // Six dots summarize the topic: filled = practiced share, dark = share needing review.
                          const total = t.questionIds.length;
                          const doneShare = Math.round((t.questionIds.filter((id) => stateById.get(id)?.lastOutcome === "correct").length / total) * 6);
                          const nowShare = Math.round((t.questionIds.filter((id) => (stateById.get(id)?.seenCount ?? 0) > 0 && stateById.get(id)?.lastOutcome !== "correct").length / total) * 6);
                          return <span key={k} className={`o-step ${k < doneShare ? "o-step-done" : k < doneShare + nowShare ? "o-step-now" : ""}`} />;
                        })}
                      </span>
                      <Icon name="chevronRight" />
                    </Link>
                  );
                })}
              </div>
            </section>
            <section className="o-card">
              <div className="o-sec-h">
                <h2 className="o-h2">Needs work and saved</h2>
                <span className="o-meta">{weak.length} questions</span>
              </div>
              {weak.length === 0 && <p className="o-help">Nothing here yet.</p>}
              <div className="o-list">
                {weak.slice(0, 20).map((id) => {
                  const q = getQuestion(id)!;
                  const r = stateById.get(id);
                  const tag = !r?.seenCount ? "Not practiced" : r.lastOutcome === "uncertain" ? "Not sure" : r.lastOutcome === "incorrect" ? "Review again" : "Got it last time";
                  return (
                    <Link key={id} href={{ pathname: "/practice/session", query: { kind: "single", id } }} className="o-libtn">
                      <span className="o-grow">
                        <span style={{ display: "block" }}>{q.prompt}</span>
                        <span className="o-row-wrap" style={{ marginTop: ".25em" }}>
                          <span className={`o-tag ${r?.lastOutcome === "uncertain" ? "o-tag-warn" : "o-tag-n"}`}>{tag}</span>
                          {s.bookmarks.includes(id) && <span className="o-tag o-tag-t">Saved</span>}
                        </span>
                      </span>
                      <Icon name="chevronRight" />
                    </Link>
                  );
                })}
              </div>
              {weak.length > 0 && (
                <Link href="/practice/session?kind=weak" className="o-btn o-btn-s" style={{ alignSelf: "flex-start" }}>
                  Practice all of these
                </Link>
              )}
            </section>
          </div>
          <div className="o-stack">
            <section className="o-card">
              <h2 className="o-h2">Mock tests</h2>
              <div className="o-stack-s">
                <div className="o-strong">Sample walkthrough · 5 questions</div>
                <div className="o-help">Answer, then check yourself.</div>
                <Link href="/practice/mock?kind=walkthrough" className="o-btn o-btn-p" style={{ alignSelf: "flex-start" }} data-testid="start-walkthrough">
                  Start walkthrough
                </Link>
              </div>
              <div className="o-stack-s" style={{ paddingTop: ".75em", borderTop: "1px solid var(--line)" }}>
                <div className="o-row-wrap">
                  <span className="o-strong">Full-format mock</span>
                  {s.route.key === "none" && <span className="o-tag o-tag-n">Needs your test version</span>}
                </div>
                <div className="o-help">{s.route.mock}</div>
                {s.route.key !== "none" ? (
                  <Link href="/practice/mock?kind=full" className="o-btn o-btn-s" style={{ alignSelf: "flex-start" }} data-testid="start-full-mock">
                    Start full-format mock
                  </Link>
                ) : (
                  <div className="o-meta">Add your filing date in Settings or on Today.</div>
                )}
              </div>
            </section>
            <section className="o-card">
              <h2 className="o-h2">How to practice</h2>
              <fieldset style={{ border: 0, margin: 0, padding: 0 }} className="o-stack-s">
                <legend className="o-label">Answer mode</legend>
                <div className="o-seg">
                  {(["recall", "choice"] as const).map((m) => (
                    <label key={m} className={mode === m ? "o-on" : ""}>
                      <input
                        type="radio"
                        name="mode"
                        checked={mode === m}
                        onChange={() => {
                          setDraft((d) => ({ ...d, mode: m }));
                          void saveProfile({ mode: m });
                        }}
                      />
                      <span>{m === "recall" ? "Recall (recommended)" : "Multiple choice"}</span>
                    </label>
                  ))}
                </div>
                <p className="o-meta">{mode === "recall" ? "Like the interview. Counts toward progress." : "Easier. Doesn’t count toward progress."}</p>
              </fieldset>
              <label className="o-switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={autoplay}
                  onChange={() => {
                    setDraft((d) => ({ ...d, autoplay: !autoplay }));
                    void saveProfile({ autoplay: !autoplay });
                  }}
                />
                <span className="o-switch-ui" />
                <span className="o-grow">Read questions aloud</span>
              </label>
            </section>
          </div>
        </div>
      </div>
      {sheet === "filing" && <FilingSheet profile={s.profile} onClose={() => setSheet(null)} />}
    </Screen>
  );
}
