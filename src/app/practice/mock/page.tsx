"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { abandonMock, answerMock, createMock, currentQuestionId, pauseMock, resumeMock, startMock, WALKTHROUGH_RULES, type MockState } from "@/domain/mock";
import { randomSeed } from "@/domain/rng";
import type { Outcome, PracticeAttempt } from "@/domain/types";
import { fmtDate } from "@/domain/validation";
import { getPack, getQuestion } from "@/lib/content";
import { practiceBank } from "@/lib/path";
import { getOpenMock, listDynamicAnswers, listMocks, recordAttempt, saveMock, setChecklist } from "@/lib/store/repo";
import { newId, nowIso } from "@/lib/store/events";
import { useData } from "@/lib/store/useData";
import { loadSnapshot } from "@/lib/today";
import { Icon } from "@/components/icons";
import { ListenButton } from "@/components/ListenButton";
import { Sheet, useToast } from "@/components/Overlay";
import { Screen, Steps } from "@/components/Screen";

type Kind = "walkthrough" | "full";

function MockInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const kind = (params.get("kind") === "full" ? "full" : "walkthrough") as Kind;
  const { data: s } = useData(loadSnapshot);
  const { data: open } = useData(getOpenMock);
  const { data: mocks } = useData(listMocks);
  const { data: confirmed } = useData(listDynamicAnswers);
  const [attempt, setAttempt] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [attemptId, setAttemptId] = useState(() => newId());
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<"exit" | null>(null);
  const [finished, setFinished] = useState<MockState | null>(null);
  if (!s || open === undefined || !mocks || !confirmed) return null;

  const bank = practiceBank(s.route);
  const pack = getPack(bank);
  const confirmedIds = new Set(confirmed.map((c) => c.questionId));
  const pool = s.questions.map((q) => ({ id: q.id, special: q.special, unscorable: Boolean(q.dynamic) && !confirmedIds.has(q.id) }));
  const label = kind === "walkthrough" ? "Sample walkthrough" : "Full-format mock";

  const begin = async () => {
    if (kind === "full" && s.route.key === "none") return;
    const state = startMock(createMock({ id: newId(), kind, bank, packVersion: pack.version, special: kind === "full" && s.route.special, pool, seed: randomSeed(), now: nowIso() }), nowIso());
    await saveMock(state);
    setAttemptId(newId());
  };

  const mark = async (state: MockState, outcome: Outcome) => {
    if (busy) return;
    setBusy(true);
    const qid = currentQuestionId(state)!;
    const at = nowIso();
    const a: PracticeAttempt = { id: attemptId, questionId: qid, bank, packVersion: pack.version, outcome, method: "mock-self", prompted: false, context: "mock", mockId: state.config.id, at };
    await recordAttempt(a);
    const next = answerMock(state, { outcome, method: "mock-self", prompted: false, at });
    await saveMock(next);
    if (next.status === "finished") {
      await setChecklist({ itemId: "mock", completedAt: nowIso(), remind: false });
      setFinished(next);
    }
    setAttempt("");
    setRevealed(false);
    setAttemptId(newId());
    setBusy(false);
  };

  // ---- result ----
  const result = finished ?? null;
  if (result?.result) {
    const r = result.result;
    const rows = result.answers.map((a) => ({ q: getQuestion(a.questionId)?.prompt ?? "", r: a.outcome }));
    const work = result.answers.filter((a) => a.outcome !== "correct").map((a) => a.questionId);
    const stopNote = r.reason === "exhausted" ? `All ${r.asked} questions asked.` : r.reason === "abandoned" ? "Ended early by you." : `Stopped early after ${r.reason === "reached-pass" ? `${r.pass} correct` : `${result.config.rules.stopIncorrect} incorrect`}, like the real stop rule.`;
    return (
      <Screen
        title="Practice"
        tab="practice"
        back="/practice"
        showSettings={false}
        actions={
          <>
            {work.length > 0 && (
              <Link href={{ pathname: "/practice/session", query: { kind: "weak" } }} className="o-btn o-btn-p o-btn-lg o-btn-block">
                Review the {work.length} to work on
              </Link>
            )}
            <Link href="/practice" className="o-btn o-btn-s o-btn-block">
              Back to Practice
            </Link>
          </>
        }
      >
        <div className="o-page o-narrow" data-testid="mock-results">
          <div className="o-stack-xs">
            <h1 className="o-h1">{kind === "walkthrough" ? "Walkthrough results" : "Mock results"}</h1>
            <span className="o-meta">
              {fmtDate(result.finishedAt?.slice(0, 10))} · {label.toLowerCase()}
              {result.config.special ? " · 65/20 format" : ""}
            </span>
          </div>
          <div className="o-card">
            <div className="o-count">
              <div className="o-count-n" data-testid="mock-score">
                {r.correct} <span>of {r.attempted} correct</span>
              </div>
              <div className="o-help">{stopNote}</div>
            </div>
            <div className="o-grid3">
              <div>
                <div className="o-strong">{r.attempted}</div>
                <div className="o-meta">Attempted</div>
              </div>
              <div>
                <div className="o-strong">{r.incorrect}</div>
                <div className="o-meta">Incorrect</div>
              </div>
              <div>
                <div className="o-strong">{r.uncertain}</div>
                <div className="o-meta">Not sure</div>
              </div>
            </div>
          </div>
          <div className="o-card o-card-amber" style={{ gap: ".25em" }}>
            <div className="o-strong">Practice result only</div>
            {kind === "full" && <div className="o-meta">{r.passed ? `Reached the passing mark (${r.pass} correct).` : `Passing needs ${r.pass} correct.`} Self-assessed, not a prediction.</div>}
          </div>
          <section className="o-card" style={{ gap: 0 }}>
            <h2 className="o-h2" style={{ marginBottom: ".5em" }}>
              Question by question
            </h2>
            {rows.map((row, idx) => (
              <div key={idx} className="o-li">
                <div className="o-grow">{row.q}</div>
                <span className={`o-tag ${row.r === "correct" ? "o-tag-ok" : row.r === "incorrect" ? "o-tag-n" : "o-tag-warn"}`}>{row.r === "correct" ? "Correct" : row.r === "incorrect" ? "Incorrect" : "Not sure"}</span>
              </div>
            ))}
          </section>
        </div>
      </Screen>
    );
  }

  // ---- in progress ----
  const active = open && open.config.kind === kind ? open : null;
  if (active) {
    if (active.status === "paused") {
      return (
        <Screen title="Practice" tab="practice" back="/practice" showSettings={false}>
          <div className="o-page o-narrow">
            <div className="o-card o-card-guide">
              <div className="o-strong">{label} paused</div>
              <div className="o-meta">
                Question {active.index + 1} of up to {active.config.rules.asked} · {active.answers.length} answered
              </div>
              <div className="o-actions-2">
                <button className="o-btn o-btn-n" type="button" onClick={() => saveMock(abandonMock(active, nowIso())).then(() => setFinished(abandonMock(active, nowIso())))}>
                  End and see results
                </button>
                <button className="o-btn o-btn-p" type="button" onClick={() => saveMock(resumeMock(active))} data-testid="resume-mock">
                  Resume
                </button>
              </div>
            </div>
          </div>
        </Screen>
      );
    }
    const qid = currentQuestionId(active);
    const q = qid ? getQuestion(qid) : null;
    if (!q) return null;
    const c = active.answers.filter((a) => a.outcome === "correct").length;
    const w = active.answers.filter((a) => a.outcome === "incorrect").length;
    const u = active.answers.filter((a) => a.outcome === "uncertain").length;
    const total = active.config.rules.asked;
    const head = q.requiredCount > 1 ? `Accepted answers · give ${q.requiredCount}` : q.answers.length > 1 ? "Accepted answers · any one is enough" : "Accepted answer";
    const actions = !revealed ? (
      <button className="o-btn o-btn-p o-btn-lg o-btn-block" type="button" onClick={() => setRevealed(true)} data-testid="mock-reveal">
        Show answer
      </button>
    ) : (
      <div className="o-actions-row">
        <button className="o-btn o-btn-p o-btn-col" type="button" onClick={() => mark(active, "correct")} disabled={busy} data-testid="mock-correct">
          <Icon name="check" />
          Correct
        </button>
        <button className="o-btn o-btn-n o-btn-col" type="button" onClick={() => mark(active, "incorrect")} disabled={busy} data-testid="mock-incorrect">
          <Icon name="again" />
          Incorrect
        </button>
        <button className="o-btn o-btn-n o-btn-col" type="button" onClick={() => mark(active, "uncertain")} disabled={busy} data-testid="mock-unsure">
          <Icon name="flag" />
          Not sure
        </button>
      </div>
    );
    return (
      <Screen title="Practice" tab="practice" back={() => setSheet("exit")} backLabel="Exit walkthrough" showTabs={false} showSettings={false} actions={actions}>
        <div className="o-page o-narrow">
          <div className="o-stack-s">
            <div className="o-row-between">
              <span className="o-meta" data-testid="mock-position">
                {label} · question {active.index + 1} of up to {total}
              </span>
              <span className="o-meta" style={{ textAlign: "right" }}>
                Correct {c} · Incorrect {w} · Not sure {u}
              </span>
            </div>
            <Steps count={total} current={active.index} full />
          </div>
          <section className="o-card">
            <p className="o-q">{q.prompt}</p>
            <ListenButton text={q.prompt} rate={s.profile.audioRate} style={{ alignSelf: "flex-start" }} />
            {!revealed && (
              <div>
                <label className="o-label" htmlFor="mk-attempt">
                  Your answer <span className="o-meta">(optional)</span>
                </label>
                <textarea id="mk-attempt" className="o-input" value={attempt} onChange={(e) => setAttempt(e.target.value)} placeholder="Say it out loud, or type it here" />
              </div>
            )}
          </section>
          {revealed && (
            <section className="o-card o-reveal" aria-live="polite">
              <div className="o-meta">{head}</div>
              <ul className="o-row-wrap">
                {q.answers.map((a) => (
                  <li key={a.text} className="o-chip">
                    {a.text}
                  </li>
                ))}
              </ul>
              {q.dynamic && <div className="o-help">Depends on where you live.</div>}
              {attempt && (
                <div>
                  <span className="o-meta">You wrote:</span> {attempt}
                </div>
              )}
            </section>
          )}
        </div>
        {sheet === "exit" && (
          <Sheet title={`Exit the ${kind === "walkthrough" ? "walkthrough" : "mock"}?`} onClose={() => setSheet(null)}>
            <p>Your answers are kept.</p>
            <div className="o-actions-2">
              <button className="o-btn o-btn-n" type="button" onClick={() => setSheet(null)}>
                Keep going
              </button>
              <button
                className="o-btn o-btn-p"
                type="button"
                onClick={async () => {
                  await saveMock(pauseMock(active));
                  setSheet(null);
                  toast(`${label} saved. Resume it from Practice.`);
                  router.push("/practice");
                }}
                data-testid="pause-mock"
              >
                Save and exit
              </button>
            </div>
          </Sheet>
        )}
      </Screen>
    );
  }

  // ---- intro ----
  const rules = kind === "walkthrough" ? WALKTHROUGH_RULES : null;
  const past = mocks.filter((m) => m.status === "finished" && m.result && m.config.kind === kind).sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? "")).slice(0, 5);
  const canStart = kind === "walkthrough" || s.route.key !== "none";
  return (
    <Screen
      title="Practice"
      tab="practice"
      back="/practice"
      showSettings={false}
      actions={
        <button className="o-btn o-btn-p o-btn-lg o-btn-block" type="button" onClick={begin} disabled={!canStart} data-testid="start-mock">
          {kind === "walkthrough" ? "Start the walkthrough" : "Start the mock"}
        </button>
      }
    >
      <div className="o-page o-narrow">
        <div className="o-stack-s">
          <h1 className="o-h1">{label}</h1>
          {kind === "walkthrough" ? (
            <span className="o-tag o-tag-warn" style={{ alignSelf: "flex-start" }}>
              Practice format · not a full mock
            </span>
          ) : (
            <span className="o-tag o-tag-t" style={{ alignSelf: "flex-start" }}>
              Real stop rule for your path
            </span>
          )}
        </div>
        <p>{kind === "walkthrough" ? "5 questions. Answer, then mark yourself." : `Up to ${s.route.asked ?? 20} questions. Answer out loud, then mark yourself.`}</p>
        <div className="o-card o-card-guide">
          <div className="o-meta">The real test for your path</div>
          <div className="o-strong">{s.route.name}</div>
          <div>{s.route.mock}</div>
        </div>
        <ul className="o-stack-s">
          <li className="o-row" style={{ alignItems: "flex-start" }}>
            <Icon name="check" />
            <span>Stop and resume any time.</span>
          </li>
          <li className="o-row" style={{ alignItems: "flex-start" }}>
            <Icon name="check" />
            <span>{rules ? `Ends early at ${rules.pass} correct or ${rules.stopIncorrect} wrong.` : "Ends early when the result is decided, like the real interview. Unsure counts as not correct."}</span>
          </li>
        </ul>
        {pool.some((p) => p.unscorable) && <p className="o-meta">{pool.filter((p) => p.unscorable).length} questions with changing answers are left out until you confirm them from an official source.</p>}
        {past.length > 0 && (
          <section className="o-card" style={{ gap: 0 }}>
            <h2 className="o-h2" style={{ marginBottom: ".5em" }}>
              Past {kind === "walkthrough" ? "walkthroughs" : "mocks"}
            </h2>
            {past.map((m) => (
              <div key={m.config.id} className="o-li">
                <div className="o-grow">
                  <div className="o-strong">
                    {m.result!.correct} of {m.result!.attempted} correct
                  </div>
                  <div className="o-meta">{fmtDate(m.finishedAt?.slice(0, 10))}</div>
                </div>
                <span className="o-meta">
                  {m.result!.incorrect} incorrect · {m.result!.uncertain} not sure
                </span>
              </div>
            ))}
          </section>
        )}
      </div>
    </Screen>
  );
}

export default function MockPage() {
  return (
    <Suspense fallback={null}>
      <MockInner />
    </Suspense>
  );
}
