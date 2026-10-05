"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmtDate } from "@/domain/validation";
import { FilingSheet } from "@/components/FilingSheet";
import { MilestoneSheet } from "@/components/MilestoneSheet";
import { Icon } from "@/components/icons";
import { Screen } from "@/components/Screen";
import { Welcome } from "@/components/Welcome";
import { countdown, greeting, journeyNext, lastEnglish, loadSnapshot, planTasks, readinessTeaser, suggestWriting, uncertainIds } from "@/lib/today";
import { useData } from "@/lib/store/useData";

export default function TodayPage() {
  const router = useRouter();
  const { data: s, loading, error } = useData(loadSnapshot);
  const [sheet, setSheet] = useState<"filing" | "interview" | null>(null);
  if (loading) return null;
  if (error || !s)
    return (
      <div className="o-page">
        <div className="o-card o-card-amber">
          <div className="o-strong">Local storage is unavailable</div>
          <div>OathSteps keeps your progress on this device, but the browser blocked storage. Try a normal (non-private) window. Details: {error}</div>
        </div>
      </div>
    );
  if (!s.profile.onboarded) return <Welcome />;

  const tasks = planTasks(s);
  const minutes = tasks.reduce((a, t) => a + (t.done ? 0 : t.mins), 0);
  const studyDone = tasks.filter((t) => t.key !== "english").every((t) => t.done);
  const planDone = tasks.every((t) => t.done);
  const writing = suggestWriting(s);
  const startLabel = planDone ? "Practice more" : studyDone ? (writing ? "Start writing practice" : "Start reading practice") : "Start today’s practice";
  const startHref = !studyDone || planDone ? "/practice/session?kind=daily" : writing ? "/interview/writing" : "/interview/reading";
  const cd = countdown(s);
  const unc = uncertainIds(s);
  const lastWr = lastEnglish(s, "writing");
  const saved = s.bookmarks.filter((b) => s.questions.some((q) => q.id === b));
  const jn = journeyNext(s);
  const pathTagCls = s.route.key === "none" ? "o-tag-warn" : "o-tag-t";

  const improve: { title: string; sub: string; icon: "flag" | "pencil" | "save"; amber?: boolean; href: string }[] = [];
  if (unc.length) improve.push({ title: `Review ${unc.length} answer${unc.length === 1 ? "" : "s"} to try again`, sub: "Not sure or missed", icon: "flag", amber: true, href: "/practice/session?kind=weak" });
  if (lastWr && lastWr.outcome !== "correct") improve.push({ title: "Writing: try one more sentence", sub: `Last try ${fmtDate(lastWr.at.slice(0, 10))}: ${lastWr.text}`, icon: "pencil", href: "/interview/writing" });
  if (saved.length) improve.push({ title: `${saved.length} saved question${saved.length === 1 ? "" : "s"}`, sub: "Saved by you", icon: "save", href: "/practice/session?kind=saved" });

  const startButton = (
    <Link href={startHref as never} className="o-btn o-btn-p o-btn-lg o-btn-block" data-testid="start-today">
      {startLabel}
    </Link>
  );

  return (
    <Screen title="OathSteps" tab="today" demo={s.demo} actions={<div className="o-phone" style={{ display: "contents" }}>{startButton}</div>}>
      <div className="o-page">
        <div className="o-stack-s">
          <h1 className="o-h1">{greeting()}</h1>
          <div className="o-row-wrap">
            <button className={`o-tag ${pathTagCls}`} type="button" onClick={() => setSheet("filing")} data-testid="path-tag">
              {s.route.short}
            </button>
            <span className="o-meta">Saved on this device</span>
          </div>
        </div>
        {s.route.key === "none" && (
          <div className="o-card o-card-amber" data-testid="no-version">
            <div className="o-row o-strong" style={{ color: "var(--am)" }}>
              <Icon name="flag" />
              Your test version isn’t set
            </div>
            <div>Add your filing date to get the right test. Until then, practice uses the 2025 list.</div>
            <button className="o-btn o-btn-s" type="button" onClick={() => setSheet("filing")} style={{ alignSelf: "flex-start" }}>
              Add filing date
            </button>
          </div>
        )}
        <div className="o-cols">
          <div className="o-stack">
            {cd && (
              <div className="o-card o-card-guide" style={{ flexDirection: "row", alignItems: "center", gap: ".875em" }} data-testid="countdown">
                <span className="o-ic-tile" style={{ background: "var(--sf)" }}>
                  <Icon name="calendar" />
                </span>
                <div className="o-grow">
                  <div className="o-h2">{cd.text}</div>
                  <div className="o-meta">{cd.sub}</div>
                </div>
                <button className="o-btn o-btn-g" type="button" onClick={() => setSheet("interview")} aria-label="Edit interview date">
                  Edit
                </button>
              </div>
            )}
            <section className="o-card" aria-labelledby="plan-h">
              <div className="o-sec-h">
                <h2 id="plan-h" className="o-h2">
                  Today’s practice
                </h2>
                <span className="o-meta">About {minutes} min</span>
              </div>
              <ol className="o-stack">
                {tasks.map((t, i) => (
                  <li key={t.key} className="o-row" style={{ alignItems: "flex-start", gap: ".75em" }} data-testid={`plan-${t.key}`}>
                    {t.done ? (
                      <span className="o-node o-node-done">
                        <Icon name="check" />
                        <span className="o-sr">Done:</span>
                      </span>
                    ) : (
                      <span className="o-node" style={{ fontWeight: 700, color: "var(--ink)" }}>
                        {i + 1}
                      </span>
                    )}
                    <div className="o-grow">
                      <div className="o-strong">{t.title}</div>
                      <div className="o-help">{t.why}</div>
                      <div className="o-meta">{t.time}</div>
                    </div>
                  </li>
                ))}
              </ol>
              {planDone && (
                <div className="o-card o-card-ok" style={{ padding: ".75em 1em" }}>
                  <div className="o-row o-strong" style={{ color: "var(--fo)" }}>
                    <Icon name="check" />
                    Today’s plan is done
                  </div>
                  <div>Come back tomorrow for new reviews.</div>
                </div>
              )}
              <div className="o-desk" style={{ flexDirection: "column" }}>
                {startButton}
              </div>
            </section>
          </div>
          <div className="o-stack">
            <section className="o-card" aria-labelledby="imp-h">
              <h2 id="imp-h" className="o-h2">
                What to improve
              </h2>
              {improve.length === 0 && <p className="o-help">Nothing yet.</p>}
              <div className="o-list">
                {improve.map((it) => (
                  <Link key={it.title} href={it.href as never} className="o-libtn">
                    <span className={`o-ic-tile ${it.amber ? "o-ic-amber" : ""}`}>
                      <Icon name={it.icon} />
                    </span>
                    <span className="o-grow">
                      <span className="o-strong" style={{ display: "block" }}>
                        {it.title}
                      </span>
                      <span className="o-meta">{it.sub}</span>
                    </span>
                    <Icon name="chevronRight" />
                  </Link>
                ))}
              </div>
              {s.demo && <p className="o-meta">Demo history, not real results.</p>}
            </section>
            <div className="o-card" style={{ gap: 0 }}>
              <Link href="/readiness" className="o-libtn">
                <span className="o-ic-tile">
                  <Icon name="bars" />
                </span>
                <span className="o-grow">
                  <span className="o-strong" style={{ display: "block" }}>
                    Readiness details
                  </span>
                  <span className="o-meta">{readinessTeaser(s)}</span>
                </span>
                <Icon name="chevronRight" />
              </Link>
              <Link href={jn.href as never} className="o-libtn">
                <span className="o-ic-tile">
                  <Icon name="journey" />
                </span>
                <span className="o-grow">
                  <span className="o-strong" style={{ display: "block" }}>
                    {jn.title}
                  </span>
                  <span className="o-meta">{jn.sub}</span>
                </span>
                <Icon name="chevronRight" />
              </Link>
            </div>
            {s.sessions > 0 && (
              <div className="o-card o-card-plain">
                <div className="o-sec-h">
                  <div className="o-strong">Want guided mock interviews?</div>
                  <span className="o-meta">Optional</span>
                </div>
                <div className="o-help">Proposed 90-day pass. Core practice stays free.</div>
                <Link href="/interview/coach" className="o-btn o-btn-g" style={{ alignSelf: "flex-start" }}>
                  See what’s included
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
      {sheet === "filing" && <FilingSheet profile={s.profile} onClose={() => setSheet(null)} />}
      {sheet === "interview" && <MilestoneSheet slotKey="interview" journey={s.journey} filing={s.profile.filingDate} today={s.today} initialStatus={s.journey.interview.status === "none" ? "scheduled" : s.journey.interview.status} onClose={() => setSheet(null)} onSaved={() => router.refresh()} />}
    </Screen>
  );
}
