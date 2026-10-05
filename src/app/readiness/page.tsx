"use client";
import Link from "next/link";
import { fmtDate } from "@/domain/validation";
import { useData } from "@/lib/store/useData";
import { delayedRecalled, encountered, lastEnglish, loadSnapshot, uncertainIds } from "@/lib/today";
import { Icon } from "@/components/icons";
import { Screen } from "@/components/Screen";

export default function ReadinessPage() {
  const { data: s } = useData(loadSnapshot);
  if (!s) return null;
  const den = s.questions.length;
  const enc = encountered(s);
  const del = delayedRecalled(s);
  const unc = uncertainIds(s);
  const mocks = s.mocks
    .filter((m) => m.status === "finished" && m.result && m.finishedAt)
    .sort((a, b) => b.finishedAt!.localeCompare(a.finishedAt!))
    .slice(0, 3);
  const rd = lastEnglish(s, "reading");
  const wr = lastEnglish(s, "writing");
  const bankNote = s.route.key === "none" ? `Practicing the 2025 list (${den} questions) until you add your filing date.` : `Full list for your path: ${den} question${den === 1 ? "" : "s"}.`;
  return (
    <Screen title="Today" tab="today" back="/" showSettings={false} demo={s.demo}>
      <div className="o-page" data-testid="readiness">
        <div className="o-stack-s">
          <h1 className="o-h1">Readiness details</h1>
          <p className="o-help">What you’ve practiced. Not a prediction.</p>
        </div>
        {s.demo && (
          <span className="o-tag o-tag-warn" style={{ alignSelf: "flex-start" }}>
            <Icon name="info" />
            Includes illustrative demo history
          </span>
        )}
        <div className="o-cols">
          <div className="o-stack">
            <section className="o-card">
              <div className="o-count">
                <div className="o-count-n" data-testid="rd-seen">
                  {enc} <span>of {den}</span>
                </div>
                <h2 className="o-h2">Questions you’ve seen</h2>
              </div>
              <p className="o-help">Practiced at least once.</p>
              <p className="o-meta">{bankNote}</p>
              {enc === 0 && (
                <Link href="/practice/session?kind=daily" className="o-btn o-btn-s" style={{ alignSelf: "flex-start" }}>
                  Start practicing
                </Link>
              )}
            </section>
            <section className="o-card">
              <div className="o-count">
                <div className="o-count-n" data-testid="rd-delayed">
                  {del} <span>of {den}</span>
                </div>
                <h2 className="o-h2">Recalled after a gap</h2>
              </div>
              <p className="o-help">From memory, no hints, a day or more later.</p>
              <p className="o-meta">Checked by you or a matched answer.</p>
            </section>
            <section className="o-card">
              <div className="o-count">
                <div className="o-count-n" data-testid="rd-unsure">
                  {unc.length}
                </div>
                <h2 className="o-h2">Answers to try again</h2>
              </div>
              <p className="o-help">Marked not sure or review again.</p>
              {unc.length > 0 && (
                <Link href="/practice/session?kind=weak" className="o-btn o-btn-s" style={{ alignSelf: "flex-start" }}>
                  Review these now
                </Link>
              )}
            </section>
          </div>
          <div className="o-stack">
            <section className="o-card">
              <h2 className="o-h2">Recent practice mocks</h2>
              <p className="o-help">Last three. Practice only.</p>
              {mocks.length === 0 && (
                <>
                  <p className="o-meta">No mocks yet.</p>
                  <Link href="/practice/mock?kind=walkthrough" className="o-btn o-btn-s" style={{ alignSelf: "flex-start" }}>
                    Try the sample walkthrough
                  </Link>
                </>
              )}
              <div className="o-list">
                {mocks.map((m) => (
                  <div key={m.config.id} className="o-li">
                    <div className="o-grow">
                      <div className="o-strong">{m.config.kind === "walkthrough" ? "Sample walkthrough" : `Full-format mock${m.config.special ? " · 65/20" : ""}`}</div>
                      <div className="o-meta">{fmtDate(m.finishedAt!.slice(0, 10))}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="o-strong">
                        {m.result!.correct} of {m.result!.attempted} correct
                      </div>
                      <div className="o-meta">
                        {m.result!.incorrect} incorrect · {m.result!.uncertain} not sure
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="o-card">
              <h2 className="o-h2">English tasks</h2>
              <p className="o-help">Your own checks, not official scores.</p>
              <div className="o-list">
                <div className="o-li">
                  <span className="o-ic-tile">
                    <Icon name="guide" />
                  </span>
                  <div className="o-grow">
                    <div className="o-strong">Reading</div>
                    <div className="o-meta" data-testid="rd-reading">
                      {rd ? `Last: ${fmtDate(rd.at.slice(0, 10))} · ${rd.text}` : "Not practiced yet"}
                    </div>
                  </div>
                </div>
                <div className="o-li">
                  <span className="o-ic-tile">
                    <Icon name="pencil" />
                  </span>
                  <div className="o-grow">
                    <div className="o-strong">Writing</div>
                    <div className="o-meta" data-testid="rd-writing">
                      {wr ? `Last: ${fmtDate(wr.at.slice(0, 10))} · ${wr.text}` : "Not practiced yet"}
                    </div>
                  </div>
                </div>
              </div>
              <Link href="/interview" className="o-btn o-btn-g" style={{ alignSelf: "flex-start" }}>
                Practice English tasks
              </Link>
            </section>
          </div>
        </div>
      </div>
    </Screen>
  );
}
