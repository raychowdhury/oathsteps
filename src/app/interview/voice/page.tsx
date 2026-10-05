"use client";
import { useMemo, useRef, useState } from "react";
import { answerMatches } from "@/domain/answers";
import { seededRng, shuffle } from "@/domain/rng";
import type { PracticeAttempt } from "@/domain/types";
import { getPack } from "@/lib/content";
import { listenOnce, recognitionSupported } from "@/lib/speech";
import { recordAttempt } from "@/lib/store/repo";
import { newId, nowIso } from "@/lib/store/events";
import { useData } from "@/lib/store/useData";
import { loadSnapshot } from "@/lib/today";
import { Icon } from "@/components/icons";
import { ListenButton } from "@/components/ListenButton";
import { Sheet, useToast } from "@/components/Overlay";
import { Screen } from "@/components/Screen";

type Step = "intro" | "denied" | "unsupported" | "listening" | "processing" | "result" | "typed" | "self";
type Verdict = "accepted" | "review" | "inconclusive";

export default function VoicePage() {
  const { toast } = useToast();
  const { data: s } = useData(loadSnapshot, [], { live: false });
  const [qi, setQi] = useState(0);
  const [step, setStep] = useState<Step>("intro");
  const [perm, setPerm] = useState<"unknown" | "granted" | "denied">("unknown");
  const [sheet, setSheet] = useState<"mic" | null>(null);
  const [transcript, setTranscript] = useState("");
  const [verdict, setVerdict] = useState<Verdict>("inconclusive");
  const [typed, setTyped] = useState("");
  const [typedResult, setTypedResult] = useState<"match" | "nomatch" | null>(null);
  const [selfShown, setSelfShown] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const pool = useMemo(() => {
    if (!s) return [];
    const seed = Number(s.today.replace(/-/g, "")) >>> 0;
    return shuffle(
      s.questions.filter((q) => !q.dynamic),
      seededRng(seed),
    ).slice(0, 5);
  }, [s]);
  if (!s || pool.length === 0) return null;
  const q = pool[qi % pool.length];
  const head = q.requiredCount > 1 ? `Accepted answers · give ${q.requiredCount}` : q.answers.length > 1 ? "Accepted answers · any one is enough" : "Accepted answer";
  const supported = recognitionSupported();

  const startListening = async () => {
    setStep("listening");
    const session = listenOnce({ timeoutMs: 15000 });
    stopRef.current = session.stop;
    const r = await session.done;
    stopRef.current = null;
    if (r.status === "denied") {
      setPerm("denied");
      setStep("denied");
      return;
    }
    setPerm("granted");
    setStep("processing");
    setTranscript(r.transcript);
    if (r.status === "heard") setVerdict(answerMatches(r.transcript, q.answers) ? "accepted" : "review");
    else setVerdict("inconclusive");
    setTimeout(() => setStep("result"), 600);
  };

  const start = () => {
    if (!supported) return setStep("unsupported");
    if (perm === "granted") return startListening();
    setSheet("mic");
  };

  const grade = async (r: "got" | "again" | "unsure") => {
    const method: PracticeAttempt["method"] = step === "typed" ? "typed-match" : step === "result" ? "voice-self" : "self-unprompted";
    const a: PracticeAttempt = { id: newId(), questionId: q.id, bank: q.bank, packVersion: getPack(q.bank).version, outcome: r === "got" ? "correct" : r === "again" ? "incorrect" : "uncertain", method, prompted: false, context: "voice", at: nowIso() };
    await recordAttempt(a);
    setQi(qi + 1);
    setStep(perm === "denied" ? "denied" : "intro");
    setTyped("");
    setTypedResult(null);
    setSelfShown(false);
    setTranscript("");
    toast(r === "got" ? "Saved as “I got it”. Next question." : "Saved. This question will come back sooner.");
  };

  const canStart = step === "intro" || step === "denied" || step === "result" || step === "unsupported";
  const canGrade = step === "result" || (step === "typed" && typedResult !== null) || (step === "self" && selfShown);
  const showAlt = step === "intro" || step === "denied" || step === "unsupported";
  const showBack = step === "typed" || step === "self";
  const tagCls = verdict === "accepted" ? "o-tag-ok" : verdict === "review" ? "o-tag-warn" : "o-tag-n";
  const tagLabel = verdict === "accepted" ? "Matches an accepted answer" : verdict === "review" ? "Needs review" : "Inconclusive";
  const explain = verdict === "accepted" ? "Check it’s what you meant." : verdict === "review" ? "Part didn’t match. You decide." : "Couldn’t hear clearly. Doesn’t count against you.";

  const actions = (
    <>
      {canStart && step !== "unsupported" && (
        <button className={`o-btn ${step === "result" ? "o-btn-s" : "o-btn-p o-btn-lg"} o-btn-block`} type="button" onClick={start} data-testid="voice-start">
          <Icon name="mic" />
          {step === "result" ? "Try again" : step === "denied" ? "Try the microphone again" : "Answer with my voice"}
        </button>
      )}
      {step === "listening" && (
        <button className="o-btn o-btn-d o-btn-lg o-btn-block" type="button" onClick={() => stopRef.current?.()} data-testid="voice-stop">
          <Icon name="stop" />
          Stop
        </button>
      )}
      {canGrade && (
        <div className="o-actions-row">
          <button className="o-btn o-btn-p o-btn-col" type="button" onClick={() => grade("got")} data-testid="voice-got">
            <Icon name="check" />I got it
          </button>
          <button className="o-btn o-btn-n o-btn-col" type="button" onClick={() => grade("again")}>
            <Icon name="again" />
            Review again
          </button>
          <button className="o-btn o-btn-n o-btn-col" type="button" onClick={() => grade("unsure")}>
            <Icon name="flag" />
            Not sure
          </button>
        </div>
      )}
      {showAlt && (
        <div className="o-actions-2">
          <button className="o-btn o-btn-n" type="button" onClick={() => (setStep("typed"), setTyped(""), setTypedResult(null))} data-testid="voice-type">
            Type instead
          </button>
          <button className="o-btn o-btn-n" type="button" onClick={() => (setStep("self"), setSelfShown(false))} data-testid="voice-self">
            Check myself
          </button>
        </div>
      )}
      {showBack && (
        <button className="o-btn o-btn-g o-btn-block" type="button" onClick={() => setStep(perm === "denied" ? "denied" : supported ? "intro" : "unsupported")}>
          {perm === "denied" || !supported ? "Back to options" : "Use my voice instead"}
        </button>
      )}
    </>
  );

  return (
    <Screen title="Interview" tab="interview" back="/interview" showSettings={false} actions={actions}>
      <div className="o-page o-narrow">
        <div className="o-row-between">
          <h1 className="o-h1">Civics out loud</h1>
          <span className="o-tag o-tag-warn">Experimental</span>
        </div>
        <section className="o-card">
          <span className="o-meta">
            Question {(qi % pool.length) + 1} of {pool.length}
          </span>
          <p className="o-q">{q.prompt}</p>
          <ListenButton text={q.prompt} rate={s.profile.audioRate} style={{ alignSelf: "flex-start" }} />
        </section>

        {step === "intro" && (
          <div className="o-card o-card-guide" style={{ gap: ".375em" }}>
            <div className="o-strong">Voice is optional</div>
            <div>Your browser’s speech recognition turns what you say into text so you can compare it with the accepted answers. OathSteps records nothing; some browsers process the audio on the vendor’s servers. You always decide the result.</div>
          </div>
        )}
        {step === "unsupported" && (
          <div className="o-card o-card-amber">
            <div className="o-row o-strong" style={{ color: "var(--am)" }}>
              <Icon name="micOff" />
              Voice isn’t available in this browser
            </div>
            <div>Type or check yourself instead. Speech recognition works in Chrome, Edge and Safari.</div>
          </div>
        )}
        {step === "denied" && (
          <div className="o-card o-card-amber">
            <div className="o-row o-strong" style={{ color: "var(--am)" }}>
              <Icon name="micOff" />
              Microphone is off
            </div>
            <div>Type or check yourself instead. To use voice, allow the mic in your browser or phone settings.</div>
          </div>
        )}
        {step === "listening" && (
          <div className="o-card" style={{ alignItems: "center", textAlign: "center" }} role="status">
            <div className="o-mic o-pulse">
              <Icon name="mic" />
            </div>
            <div className="o-h2">Listening</div>
            <div className="o-help">Say your answer, then tap Stop.</div>
          </div>
        )}
        {step === "processing" && (
          <div className="o-card" style={{ alignItems: "center", textAlign: "center" }} role="status">
            <div className="o-mic">
              <Icon name="clock" />
            </div>
            <div className="o-h2">Checking what we heard</div>
            <div className="o-help">Comparing with the accepted answers</div>
          </div>
        )}
        {step === "result" && (
          <div className="o-stack o-reveal" aria-live="polite">
            <section className="o-card">
              <div className="o-row-between">
                <div className="o-meta">Heard (browser speech recognition)</div>
                <span className={`o-tag ${tagCls}`}>{tagLabel}</span>
              </div>
              <p className="o-h2" style={transcript ? undefined : { color: "var(--mut)", fontStyle: "italic" }}>
                {transcript || "No clear speech detected"}
              </p>
              <p>{explain}</p>
            </section>
            <section className="o-card">
              <div className="o-meta">{head}</div>
              <ul className="o-row-wrap">
                {q.answers.map((a) => (
                  <li key={a.text} className="o-chip">
                    {a.text}
                  </li>
                ))}
              </ul>
              <div className="o-meta">You decide the result below.</div>
            </section>
          </div>
        )}
        {step === "typed" && (
          <section className="o-card">
            <label className="o-label" htmlFor="vc-typed">
              Type your answer
            </label>
            <input id="vc-typed" className="o-input" value={typed} onChange={(e) => (setTyped(e.target.value), setTypedResult(null))} placeholder="Your answer" />
            <button className="o-btn o-btn-s" type="button" onClick={() => setTypedResult(answerMatches(typed, q.answers) ? "match" : "nomatch")} style={{ alignSelf: "flex-start" }} data-testid="voice-check-typed">
              Check against accepted answers
            </button>
            {typedResult && (
              <div className="o-stack-s o-reveal">
                <span className={`o-tag ${typedResult === "match" ? "o-tag-ok" : "o-tag-warn"}`} style={{ alignSelf: "flex-start" }}>
                  {typedResult === "match" ? "Matches an accepted answer" : "Doesn’t match exactly. Compare below."}
                </span>
                <div className="o-meta">{head}</div>
                <ul className="o-row-wrap">
                  {q.answers.map((a) => (
                    <li key={a.text} className="o-chip">
                      {a.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
        {step === "self" && (
          <section className="o-card">
            <div className="o-help">Say it aloud, then check.</div>
            {selfShown ? (
              <div className="o-stack-s o-reveal">
                <div className="o-meta">{head}</div>
                <ul className="o-row-wrap">
                  {q.answers.map((a) => (
                    <li key={a.text} className="o-chip">
                      {a.text}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <button className="o-btn o-btn-s" type="button" onClick={() => setSelfShown(true)} style={{ alignSelf: "flex-start" }} data-testid="voice-self-reveal">
                Show answer
              </button>
            )}
          </section>
        )}
      </div>
      {sheet === "mic" && (
        <Sheet title="Microphone access" onClose={() => setSheet(null)}>
          <div className="o-proto">
            <div className="o-meta">Before the browser asks</div>
            <div className="o-strong">OathSteps would like to use the microphone</div>
            <div className="o-help">Only while you practice aloud. Your browser transcribes what you say; it may use the vendor’s servers to do so. Nothing is stored by OathSteps.</div>
          </div>
          <div className="o-actions-2">
            <button
              className="o-btn o-btn-n"
              type="button"
              onClick={() => {
                setPerm("denied");
                setSheet(null);
                setStep("denied");
              }}
            >
              Don’t allow
            </button>
            <button
              className="o-btn o-btn-p"
              type="button"
              onClick={() => {
                setSheet(null);
                startListening();
              }}
              data-testid="mic-allow"
            >
              Allow
            </button>
          </div>
        </Sheet>
      )}
    </Screen>
  );
}
