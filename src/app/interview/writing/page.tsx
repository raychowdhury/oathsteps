"use client";
import Link from "next/link";
import { useState } from "react";
import tasksJson from "../../../../content/english/tasks.json";
import { compareWords, describeDiff, type WordDiff } from "@/domain/writing";
import { markDay, recordEnglishTask } from "@/lib/store/repo";
import { newId, nowIso } from "@/lib/store/events";
import { useData } from "@/lib/store/useData";
import { loadSnapshot } from "@/lib/today";
import { ListenButton } from "@/components/ListenButton";
import { useToast } from "@/components/Overlay";
import { Screen } from "@/components/Screen";

const WRITING = (tasksJson as { writing: { id: string; text: string }[] }).writing;

export default function WritingPage() {
  const { toast } = useToast();
  const { data: s } = useData(loadSnapshot, [], { live: false });
  const [idx, setIdx] = useState(0);
  const [attempt, setAttempt] = useState(1);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<WordDiff | null>(null);
  const [status, setStatus] = useState<"active" | "checked">("active");
  const [show, setShow] = useState(false);
  if (!s) return null;
  const item = WRITING[idx % WRITING.length];

  const check = async () => {
    if (!input.trim()) return toast("Write the sentence first, then check.");
    const r = compareWords(item.text, input);
    if (r.diffs === 0 || attempt >= 3) {
      // Persist first, then show the result, so leaving the page right away never loses the record.
      await recordEnglishTask({ id: newId(), kind: "writing", taskId: item.id, outcome: r.diffs === 0 ? "correct" : "incorrect", text: r.diffs === 0 ? "Matched the sentence" : describeDiff(r), selfReported: true, at: nowIso() });
      await markDay(s.today, { english: true });
    }
    setResult(r);
    setStatus("checked");
    setShow(false);
  };
  const retry = () => {
    setAttempt(attempt + 1);
    setInput("");
    setResult(null);
    setStatus("active");
  };
  const another = () => {
    setIdx(idx + 1);
    setAttempt(1);
    setInput("");
    setResult(null);
    setStatus("active");
    setShow(false);
  };
  const peek = () => {
    setShow(true);
    setTimeout(() => setShow(false), 5000);
  };
  const canRetry = status === "checked" && result && result.diffs > 0 && attempt < 3;
  const finished = status === "checked" && !canRetry;

  const actions =
    status === "active" ? (
      <button className="o-btn o-btn-p o-btn-lg o-btn-block" type="button" onClick={check} data-testid="write-check">
        Check my sentence
      </button>
    ) : canRetry ? (
      <button className="o-btn o-btn-p o-btn-lg o-btn-block" type="button" onClick={retry} data-testid="write-retry">
        Try again · attempt {Math.min(attempt + 1, 3)} of 3
      </button>
    ) : (
      <div className="o-actions-2">
        <button className="o-btn o-btn-s" type="button" onClick={another}>
          Another sentence
        </button>
        <Link href="/interview" className="o-btn o-btn-p">
          Done
        </Link>
      </div>
    );

  return (
    <Screen title="Interview" tab="interview" back="/interview" showSettings={false} actions={actions}>
      <div className="o-page o-narrow">
        <div className="o-stack-xs">
          <h1 className="o-h1">Writing practice</h1>
          <span className="o-meta">
            Attempt {Math.min(attempt, 3)} of 3 · sentence {(idx % WRITING.length) + 1}
          </span>
        </div>
        <p className="o-help">Listen, then write it.</p>
        <section className="o-card">
          <ListenButton text={item.text} rate={s.profile.audioRate} label="Listen to the sentence" style={{ alignSelf: "flex-start" }} />
          {show && <p className="o-sentence">{item.text}</p>}
          {!show && (
            <button className="o-btn o-btn-g" type="button" onClick={peek} style={{ alignSelf: "flex-start" }} data-testid="write-peek">
              Can’t play audio? Show the sentence briefly
            </button>
          )}
          <div>
            <label className="o-label" htmlFor="wr-in">
              Write the sentence
            </label>
            <input id="wr-in" className="o-input" value={input} onChange={(e) => setInput(e.target.value)} autoComplete="off" spellCheck={false} disabled={status !== "active"} />
          </div>
        </section>
        {result && (
          <section className={`o-card o-reveal ${result.diffs === 0 ? "o-card-ok" : "o-card-amber"}`} aria-live="polite" data-testid="write-result">
            <div className="o-row o-strong">{describeDiff(result)}</div>
            <div className="o-meta">Sentence</div>
            <p className="o-row-wrap" style={{ gap: ".3em" }}>
              {result.words.map((w, i) => (
                <span key={i} className={w.ok ? "o-word-ok" : "o-word-diff"}>
                  {w.t}
                </span>
              ))}
            </p>
            <div className="o-meta">Underlined words differ.</div>
            {finished && <div className="o-meta">Saved as your own check.</div>}
          </section>
        )}
      </div>
    </Screen>
  );
}
