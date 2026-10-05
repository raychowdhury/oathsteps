"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { buildMultipleChoice } from "@/domain/answers";
import { seededRng } from "@/domain/rng";
import type { ConfirmedDynamicAnswer, Outcome, PracticeAttempt } from "@/domain/types";
import { getPack, getQuestion, questionsFor, type Question } from "@/lib/content";
import { guide } from "@/lib/guide";
import { practiceBank } from "@/lib/path";
import { speak } from "@/lib/speech";
import { bumpSessions, listDynamicAnswers, markDay, recordAttempt, saveDynamicAnswer, saveReport, toggleBookmark } from "@/lib/store/repo";
import { newId, nowIso } from "@/lib/store/events";
import { useData } from "@/lib/store/useData";
import { dailyIds, dueIds, loadSnapshot, suggestWriting, uncertainIds, weakIds, type Snapshot } from "@/lib/today";
import { Icon } from "@/components/icons";
import { ListenButton } from "@/components/ListenButton";
import { ErrorLine, Sheet, useToast } from "@/components/Overlay";
import { ExtLink, Screen, Steps } from "@/components/Screen";

type Kind = "daily" | "due" | "weak" | "saved" | "topic" | "single";
type Result = "got" | "again" | "unsure" | "choice";

function hashId(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

function selectIds(s: Snapshot, kind: Kind, topic: string | null, id: string | null): string[] {
  switch (kind) {
    case "due":
      return dueIds(s);
    case "weak": {
      const u = uncertainIds(s);
      return u.length ? u : weakIds(s);
    }
    case "saved":
      return s.bookmarks.filter((b) => s.questions.some((q) => q.id === b));
    case "topic":
      return s.questions.filter((q) => q.subsection === topic).map((q) => q.id);
    case "single":
      return id ? [id] : [];
    default:
      return dailyIds(s);
  }
}

function SessionInner() {
  const params = useSearchParams();
  const kind = (params.get("kind") ?? "daily") as Kind;
  const topic = params.get("topic");
  const single = params.get("id");
  // The question list is fixed when the session starts; the snapshot is not re-read on each write.
  const { data: s } = useData(loadSnapshot, [kind, topic, single], { live: false });
  const live = useData(async () => ({ confirmed: await listDynamicAnswers() }));
  const ids = useMemo(() => (s ? selectIds(s, kind, topic, single) : null), [s, kind, topic, single]);
  if (!s || !ids || !live.data) return null;
  return <SessionRunner key={`${kind}:${topic}:${single}`} s={s} kind={kind} initialIds={ids} confirmed={live.data.confirmed} />;
}

function SessionRunner({ s, kind, initialIds, confirmed }: { s: Snapshot; kind: Kind; initialIds: string[]; confirmed: ConfirmedDynamicAnswer[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [queue, setQueue] = useState<string[]>(initialIds);
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [attempt, setAttempt] = useState("");
  const [choice, setChoice] = useState<string | null>(null);
  const [results, setResults] = useState<{ id: string; r: Result }[]>([]);
  const [requeued, setRequeued] = useState<Set<string>>(new Set());
  const [attemptId, setAttemptId] = useState(() => newId());
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => new Set(s.bookmarks));
  const [sheet, setSheet] = useState<"source" | "report" | "reportDone" | "end" | "confirm" | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const q: Question | null = i < queue.length ? (getQuestion(queue[i]) ?? null) : null;
  const isChoice = s.profile.mode === "choice";
  const bank = practiceBank(s.route);
  const pool = useMemo(() => questionsFor(bank, false), [bank]);
  const mc = useMemo(() => (q && isChoice ? buildMultipleChoice(q, pool, seededRng(hashId(q.id))) : null), [q, isChoice, pool]);

  useEffect(() => {
    if (q && s.profile.autoplay && !revealed) speak(q.prompt, s.profile.audioRate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.id]);

  if (queue.length === 0) {
    return (
      <Screen title="Practice" tab="practice" back="/practice" showTabs={false} showSettings={false}>
        <div className="o-page o-narrow">
          <div className="o-card">
            <div className="o-strong">Nothing to practice here yet.</div>
            <Link href="/practice" className="o-btn o-btn-s" style={{ alignSelf: "flex-start" }}>
              Back to Practice
            </Link>
          </div>
        </div>
      </Screen>
    );
  }

  const finish = async () => {
    await bumpSessions();
    if (kind === "daily") await markDay(s.today, { review: true, fresh: true });
    setDone(true);
  };

  const advance = async (next: typeof queue, nextResults: typeof results) => {
    setResults(nextResults);
    setQueue(next);
    setRevealed(false);
    setAttempt("");
    setChoice(null);
    setAttemptId(newId());
    if (i + 1 >= next.length) await finish();
    else setI(i + 1);
  };

  const record = async (outcome: Outcome, method: PracticeAttempt["method"], prompted: boolean) => {
    if (!q) return;
    const unresolved = Boolean(q.dynamic) && !confirmed.some((c) => c.questionId === q.id);
    const a: PracticeAttempt = { id: attemptId, questionId: q.id, bank: q.bank, packVersion: getPack(q.bank).version, outcome, method: unresolved && method === "self-unprompted" ? "self-hinted" : method, prompted: prompted || unresolved, context: kind === "due" || kind === "weak" ? "review" : kind === "topic" ? "topic" : "practice", at: nowIso() };
    await recordAttempt(a);
  };

  const grade = async (r: "got" | "again" | "unsure") => {
    if (!q || busy) return;
    setBusy(true);
    await record(r === "got" ? "correct" : r === "again" ? "incorrect" : "uncertain", "self-unprompted", false);
    let next = queue;
    const rq = new Set(requeued);
    if (r === "again" && !rq.has(q.id)) {
      next = [...queue, q.id];
      rq.add(q.id);
      setRequeued(rq);
    }
    await advance(next, [...results, { id: q.id, r }]);
    setBusy(false);
  };

  const pickChoice = async (opt: string) => {
    if (!q || !mc || choice) return;
    setChoice(opt);
    setRevealed(true);
    await record(opt === mc.correct ? "correct" : "incorrect", "multiple-choice", true);
  };
  const choiceNext = async () => {
    if (!q) return;
    await advance(queue, [...results, { id: q.id, r: "choice" }]);
  };

  const endSession = () => {
    setSheet(null);
    toast("Session ended. Marked answers are saved.");
    router.push("/practice");
  };

  if (done) {
    const got = results.filter((r) => r.r === "got").length;
    const again = results.filter((r) => r.r === "again").length;
    const unsure = results.filter((r) => r.r === "unsure").length;
    const writing = suggestWriting(s);
    const showNext = kind === "daily" && !s.day.english;
    return (
      <Screen
        title="Practice"
        tab="practice"
        back="/practice"
        showSettings={false}
        actions={
          <Link href="/" className="o-btn o-btn-s o-btn-block">
            Back to Today
          </Link>
        }
      >
        <div className="o-page o-narrow" data-testid="session-done">
          <div className="o-stack-s">
            <span className="o-hero-mark">
              <Icon name="logo" style={{ width: "2em", height: "2em" }} />
            </span>
            <h1 className="o-h1">Session complete</h1>
            <p className="o-help">You practiced {results.length} answers.</p>
          </div>
          <div className="o-grid3">
            <div className="o-card" style={{ gap: ".25em" }}>
              <div className="o-count-n" data-testid="count-got">
                {got}
              </div>
              <span className="o-tag o-tag-ok" style={{ alignSelf: "flex-start" }}>
                <Icon name="check" />
                Got it
              </span>
            </div>
            <div className="o-card" style={{ gap: ".25em" }}>
              <div className="o-count-n" data-testid="count-again">
                {again}
              </div>
              <span className="o-tag o-tag-n" style={{ alignSelf: "flex-start" }}>
                Again
              </span>
            </div>
            <div className="o-card" style={{ gap: ".25em" }}>
              <div className="o-count-n" data-testid="count-unsure">
                {unsure}
              </div>
              <span className="o-tag o-tag-warn" style={{ alignSelf: "flex-start" }}>
                Not sure
              </span>
            </div>
          </div>
          {results.some((r) => r.r === "choice") && <p className="o-meta">Multiple-choice answers aren’t counted as recall.</p>}
          <p className="o-help">Missed answers come back sooner.</p>
          {showNext && (
            <div className="o-card o-card-guide">
              <div className="o-meta">Next in today’s plan · about 3 min</div>
              <div className="o-h2">{writing ? "Writing: one sentence" : "Reading: one sentence"}</div>
              <div>Up to three tries at the interview.</div>
              <Link href={writing ? "/interview/writing" : "/interview/reading"} className="o-btn o-btn-p" style={{ alignSelf: "flex-start" }}>
                {writing ? "Start writing practice" : "Start reading practice"}
              </Link>
            </div>
          )}
        </div>
      </Screen>
    );
  }

  if (!q) return null;
  const conf = confirmed.find((c) => c.questionId === q.id) ?? null;
  const varies = Boolean(q.dynamic);
  const saved = bookmarks.has(q.id);
  const answerHead = q.requiredCount > 1 ? `Accepted answers · give ${q.requiredCount}` : q.answers.length > 1 ? "Accepted answers · any one is enough" : "Accepted answer";
  const stateName = s.profile.state;
  const variesText = stateName === "DC" ? "In D.C., answer as the official list says for the District." : stateName ? `Check the current answer for your state (${stateName}) on an official site.` : "Add your state in Settings, then check its official website.";
  const src = guide.sources[s.route.src];
  const srcLabel = q.bank === "2008" ? "From the 2008 list" : "From the 2025 list";

  const actions = (
    <>
      {!revealed && !isChoice && (
        <button className="o-btn o-btn-p o-btn-lg o-btn-block" type="button" onClick={() => setRevealed(true)} data-testid="reveal">
          Show answer
        </button>
      )}
      {revealed && (!isChoice || varies) && (
        <>
          <div className="o-meta" style={{ textAlign: "center" }}>
            How did you do, honestly?
          </div>
          <div className="o-actions-row">
            <button className="o-btn o-btn-p o-btn-col" type="button" onClick={() => grade("got")} disabled={busy} data-testid="grade-got">
              <Icon name="check" />I got it
            </button>
            <button className="o-btn o-btn-n o-btn-col" type="button" onClick={() => grade("again")} disabled={busy} data-testid="grade-again">
              <Icon name="again" />
              Review again
            </button>
            <button className="o-btn o-btn-n o-btn-col" type="button" onClick={() => grade("unsure")} disabled={busy} data-testid="grade-unsure">
              <Icon name="flag" />
              Not sure
            </button>
          </div>
        </>
      )}
      {revealed && isChoice && !varies && (
        <button className="o-btn o-btn-p o-btn-lg o-btn-block" type="button" onClick={choiceNext} data-testid="choice-next">
          Next question
        </button>
      )}
      {!revealed && isChoice && (
        <button className="o-btn o-btn-n o-btn-block" type="button" onClick={() => setRevealed(true)}>
          Show the answer guidance
        </button>
      )}
    </>
  );

  return (
    <Screen title="Practice" tab="practice" back={() => setSheet("end")} backLabel="End session" showTabs={false} showSettings={false} actions={actions}>
      <div className="o-page o-narrow">
        <div className="o-row-between" style={{ alignItems: "flex-end" }}>
          <div className="o-stack-s o-grow">
            <span className="o-meta" data-testid="q-position">
              Question {i + 1} of {queue.length}
            </span>
            <Steps count={queue.length} current={i} full />
          </div>
          <span className="o-tag o-tag-n" style={{ whiteSpace: "normal", textAlign: "right", maxWidth: "50%" }}>
            {q.subsection}
          </span>
        </div>
        {isChoice && (
          <div className="o-card o-card-amber" style={{ padding: ".625em .875em", gap: ".25em" }}>
            <div className="o-strong">Multiple choice · not counted as recall</div>
          </div>
        )}
        <section className="o-card">
          <p className="o-q" data-testid="q-text">
            {q.prompt}
          </p>
          {q.note && <p className="o-meta">{q.note}</p>}
          <div className="o-row-wrap">
            <ListenButton text={q.prompt} rate={s.profile.audioRate} />
            <button
              className="o-btn o-btn-g"
              type="button"
              aria-pressed={saved}
              onClick={async () => {
                const now = await toggleBookmark(q.id);
                const b = new Set(bookmarks);
                if (now) b.add(q.id);
                else b.delete(q.id);
                setBookmarks(b);
              }}
              data-testid="save-question"
            >
              <Icon name="save" style={saved ? { fill: "currentColor" } : undefined} />
              {saved ? "Saved" : "Save"}
            </button>
          </div>
          {!isChoice && !revealed && (
            <div>
              <label className="o-label" htmlFor="q-attempt">
                Your answer <span className="o-meta">(optional)</span>
              </label>
              <textarea id="q-attempt" className="o-input" value={attempt} onChange={(e) => setAttempt(e.target.value)} placeholder="Say it out loud, or type it here" />
            </div>
          )}
          {isChoice && !varies && mc && (
            <fieldset style={{ border: 0, margin: 0, padding: 0 }} className="o-stack-s">
              <legend className="o-label">Choose one</legend>
              {mc.options.map((opt) => {
                const correct = opt === mc.correct;
                const on = choice === opt;
                return (
                  <label key={opt} className={`o-opt ${revealed ? (correct ? "o-opt-on" : "") : on ? "o-opt-on" : ""}`}>
                    <input type="radio" name="q-choice" checked={on} disabled={revealed} onChange={() => pickChoice(opt)} />
                    <span className="o-grow">{opt}</span>
                    {revealed && correct && <span className="o-tag o-tag-ok">Correct answer</span>}
                    {revealed && on && !correct && <span className="o-tag o-tag-n">Your choice</span>}
                  </label>
                );
              })}
            </fieldset>
          )}
          {isChoice && varies && !revealed && (
            <div className="o-card o-card-amber" style={{ padding: ".625em .875em" }}>
              No choices: the answer depends on where you live.
            </div>
          )}
        </section>
        {revealed && (
          <section className="o-card o-reveal" aria-live="polite" data-testid="answer-card">
            {!varies && (
              <>
                <div className="o-meta">{answerHead}</div>
                <ul className="o-row-wrap">
                  {q.answers.map((a) => (
                    <li key={a.text} className="o-chip" title={a.note}>
                      {a.text}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {varies && (
              <div className="o-card o-card-amber" style={{ padding: ".75em" }}>
                <div className="o-row o-strong" style={{ color: "var(--am)" }}>
                  <Icon name="flag" />
                  Answer depends on where you live
                </div>
                <div>{conf ? `You confirmed: ${conf.answer} (${conf.region}, checked ${conf.confirmedOn}).` : variesText}</div>
                {q.answers[0]?.note && <div className="o-meta">{q.answers[0].note}</div>}
                <ExtLink href={q.dynamic!.lookupUrl}>{q.dynamic!.lookupLabel}</ExtLink>
                <button className="o-btn o-btn-s" type="button" onClick={() => setSheet("confirm")} style={{ alignSelf: "flex-start" }} data-testid="confirm-dynamic">
                  {conf ? "Update the answer I confirmed" : "Record the answer I confirmed"}
                </button>
              </div>
            )}
            {attempt && !isChoice && (
              <div>
                <span className="o-meta">You wrote:</span> {attempt}
              </div>
            )}
            <div className="o-row-wrap" style={{ justifyContent: "space-between" }}>
              <span className="o-meta">{srcLabel}</span>
              <span className="o-row">
                <button className="o-btn o-btn-g" type="button" onClick={() => setSheet("source")}>
                  Source and details
                </button>
                <button className="o-btn o-btn-g" type="button" onClick={() => setSheet("report")}>
                  Report an issue
                </button>
              </span>
            </div>
          </section>
        )}
      </div>

      {sheet === "source" && (
        <Sheet title="Source and details" onClose={() => setSheet(null)}>
          <p>{q.prompt}</p>
          <div className={`o-card ${getPack(q.bank).review.humanReviewed ? "o-card-guide" : "o-card-amber"}`} style={{ gap: ".25em" }}>
            <div className="o-strong">{getPack(q.bank).review.humanReviewed ? "Official wording · machine-checked and expert-reviewed" : "Official wording · machine-checked, not yet expert-reviewed"}</div>
            <div className="o-meta">
              Question {q.number} of the {q.bank} list · pack {getPack(q.bank).version}
            </div>
          </div>
          <div className="o-stack-xs">
            <div className="o-meta">Official source for your path</div>
            <ExtLink href={src.url}>{src.label}</ExtLink>
          </div>
          {varies && <div className="o-help">Changes with elections. Check before your interview.</div>}
        </Sheet>
      )}
      {sheet === "report" && <ReportSheet questionId={q.id} packVersion={getPack(q.bank).version} onDone={() => setSheet("reportDone")} onClose={() => setSheet(null)} />}
      {sheet === "reportDone" && (
        <Sheet title="Report an issue" onClose={() => setSheet(null)}>
          <div className="o-card o-card-ok">
            <div className="o-row o-strong" style={{ color: "var(--fo)" }}>
              <Icon name="check" />
              Report saved
            </div>
            <div>Thanks. It stays on this device and is included in your export.</div>
          </div>
          <button className="o-btn o-btn-p o-btn-block" type="button" onClick={() => setSheet(null)}>
            Back to the question
          </button>
        </Sheet>
      )}
      {sheet === "end" && (
        <Sheet title="End this session?" onClose={() => setSheet(null)}>
          <p>Marked answers are saved.</p>
          <div className="o-actions-2">
            <button className="o-btn o-btn-n" type="button" onClick={() => setSheet(null)}>
              Keep going
            </button>
            <button className="o-btn o-btn-p" type="button" onClick={endSession} data-testid="end-session">
              End session
            </button>
          </div>
        </Sheet>
      )}
      {sheet === "confirm" && <ConfirmDynamicSheet question={q} initial={conf} today={s.today} onClose={() => setSheet(null)} />}
    </Screen>
  );
}

const REPORT_REASONS = ["The answer looks wrong", "The answer is out of date", "Audio doesn’t match the text", "Translation problem", "Something else"];

function ReportSheet({ questionId, packVersion, onDone, onClose }: { questionId: string; packVersion: string; onDone: () => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [text, setText] = useState("");
  const [err, setErr] = useState(false);
  const submit = async () => {
    if (!reason) return setErr(true);
    await saveReport({ id: newId(), questionId, packVersion, reason, message: text.slice(0, 300), createdAt: nowIso() });
    onDone();
  };
  return (
    <Sheet title="Report an issue" onClose={onClose}>
      <p className="o-help">Reports stay on this device until you export or sync them.</p>
      <fieldset style={{ border: 0, margin: 0, padding: 0 }} className="o-stack-s">
        <legend className="o-label">What’s the problem?</legend>
        {REPORT_REASONS.map((l) => (
          <label key={l} className={`o-opt ${reason === l ? "o-opt-on" : ""}`}>
            <input
              type="radio"
              name="rep"
              checked={reason === l}
              onChange={() => {
                setReason(l);
                setErr(false);
              }}
            />
            <span>{l}</span>
          </label>
        ))}
      </fieldset>
      {err && <ErrorLine>Choose one problem so we know what to check.</ErrorLine>}
      <div>
        <label className="o-label" htmlFor="rep-text">
          Details <span className="o-meta">(optional)</span>
        </label>
        <textarea id="rep-text" className="o-input" value={text} onChange={(e) => setText(e.target.value.slice(0, 300))} maxLength={300} placeholder="Don’t include personal information" />
        <div className="o-meta" style={{ marginTop: ".25em" }}>
          {text.length} of 300 characters
        </div>
      </div>
      <button className="o-btn o-btn-p o-btn-block" type="button" onClick={submit} data-testid="send-report">
        Send report
      </button>
    </Sheet>
  );
}

function ConfirmDynamicSheet({ question, initial, today, onClose }: { question: Question; initial: ConfirmedDynamicAnswer | null; today: string; onClose: () => void }) {
  const [answer, setAnswer] = useState(initial?.answer ?? "");
  const [region, setRegion] = useState(initial?.region ?? (question.dynamic?.scope === "federal" ? "United States" : ""));
  const [date, setDate] = useState(initial?.confirmedOn ?? today);
  const [err, setErr] = useState("");
  const save = async () => {
    if (!answer.trim() || !region.trim()) return setErr("Enter the answer and where it applies.");
    await saveDynamicAnswer({ questionId: question.id, answer: answer.trim(), region: region.trim(), confirmedOn: date, sourceUrl: question.dynamic?.lookupUrl ?? "" });
    onClose();
  };
  return (
    <Sheet title="Record the answer you confirmed" onClose={onClose}>
      <p className="o-help">Check an official source first. This stays on your device and is never generated by the app.</p>
      <div>
        <label className="o-label" htmlFor="dyn-answer">
          Answer you confirmed
        </label>
        <input id="dyn-answer" className="o-input" value={answer} onChange={(e) => setAnswer(e.target.value)} />
      </div>
      <div>
        <label className="o-label" htmlFor="dyn-region">
          {question.dynamic?.scope === "district" ? "Your state and district" : question.dynamic?.scope === "state" ? "Your state or territory" : "Applies to"}
        </label>
        <input id="dyn-region" className="o-input" value={region} onChange={(e) => setRegion(e.target.value)} />
      </div>
      <div>
        <label className="o-label" htmlFor="dyn-date">
          Date you checked
        </label>
        <input id="dyn-date" className="o-input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
      </div>
      {err && <ErrorLine>{err}</ErrorLine>}
      <div className="o-actions-2">
        <button className="o-btn o-btn-n" type="button" onClick={onClose}>
          Cancel
        </button>
        <button className="o-btn o-btn-p" type="button" onClick={save} data-testid="save-dynamic">
          Save
        </button>
      </div>
    </Sheet>
  );
}

export default function SessionPage() {
  return (
    <Suspense fallback={null}>
      <SessionInner />
    </Suspense>
  );
}
