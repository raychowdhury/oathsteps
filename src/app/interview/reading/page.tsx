"use client";
import Link from "next/link";
import { useState } from "react";
import tasksJson from "../../../../content/english/tasks.json";
import { markDay, recordEnglishTask } from "@/lib/store/repo";
import { newId, nowIso } from "@/lib/store/events";
import { useData } from "@/lib/store/useData";
import { loadSnapshot } from "@/lib/today";
import { Icon } from "@/components/icons";
import { ListenButton } from "@/components/ListenButton";
import { Screen } from "@/components/Screen";

const READING = (tasksJson as { reading: { id: string; text: string }[] }).reading;

export default function ReadingPage() {
  const { data: s } = useData(loadSnapshot, [], { live: false });
  const [idx, setIdx] = useState(0);
  const [attempt, setAttempt] = useState(1);
  const [results, setResults] = useState<boolean[]>([]);
  const [status, setStatus] = useState<"active" | "done" | "out">("active");
  if (!s) return null;
  const item = READING[idx % READING.length];

  const finish = async (ok: boolean) => {
    const next = [...results, ok];
    setResults(next);
    if (!ok && attempt < 3) return setAttempt(attempt + 1);
    // Persist first, then confirm on screen, so leaving the page right away never loses the record.
    await recordEnglishTask({ id: newId(), kind: "reading", taskId: item.id, outcome: ok ? "correct" : "incorrect", text: ok ? "Read clearly (your own check)" : "Had trouble after 3 tries", selfReported: true, at: nowIso() });
    await markDay(s.today, { english: true });
    setStatus(ok ? "done" : "out");
  };
  const another = () => {
    setIdx(idx + 1);
    setAttempt(1);
    setResults([]);
    setStatus("active");
  };

  const actions =
    status === "active" ? (
      <div className="o-actions-2">
        <button className="o-btn o-btn-p" type="button" onClick={() => finish(true)} data-testid="read-clear">
          I read it clearly
        </button>
        <button className="o-btn o-btn-n" type="button" onClick={() => finish(false)} data-testid="read-trouble">
          I had trouble
        </button>
      </div>
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
          <h1 className="o-h1">Reading practice</h1>
          <span className="o-meta">
            Attempt {Math.min(attempt, 3)} of 3 · sentence {(idx % READING.length) + 1}
          </span>
        </div>
        <p className="o-help">Read it aloud. Accents are fine.</p>
        <section className="o-card">
          <p className="o-sentence" lang="en" data-testid="reading-sentence">
            {item.text}
          </p>
          <ListenButton text={item.text} rate={s.profile.audioRate} label="Hear it after you try" ghost style={{ alignSelf: "flex-start" }} />
        </section>
        {status === "done" && (
          <div className="o-card o-card-ok o-reveal">
            <div className="o-row o-strong" style={{ color: "var(--fo)" }}>
              <Icon name="check" />
              You read it clearly
            </div>
            <div>One correct sentence passes. Your own check.</div>
          </div>
        )}
        {status === "out" && (
          <div className="o-card o-card-amber o-reveal">
            <div className="o-strong">That’s three tries</div>
            <div>Try a new sentence later.</div>
          </div>
        )}
        <div className="o-row-wrap">
          <span className="o-meta">This attempt’s history:</span>
          {results.length === 0 ? (
            <span className="o-tag o-tag-n">None yet</span>
          ) : (
            results.map((r, i) => (
              <span key={i} className={`o-tag ${r ? "o-tag-ok" : "o-tag-n"}`}>
                Try {i + 1}: {r ? "clear" : "had trouble"}
              </span>
            ))
          )}
        </div>
      </div>
    </Screen>
  );
}
