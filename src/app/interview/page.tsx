"use client";
import { useState } from "react";
import tasksJson from "../../../content/english/tasks.json";
import { normalize } from "@/domain/answers";
import type { EnglishTaskRecord, Outcome } from "@/domain/types";
import { getProfile, listEnglishTasks, recordEnglishTask } from "@/lib/store/repo";
import { newId, nowIso } from "@/lib/store/events";
import { useData } from "@/lib/store/useData";
import { SpeakButton } from "@/components/SpeakButton";
import { Button, Card, ExternalLink, Input, Notice, PageTitle, Pill, Spinner } from "@/components/ui";

type Kind = EnglishTaskRecord["kind"];
const tasks = tasksJson as {
  review: { note: string };
  sources: { label: string; url: string }[];
  reading: { id: string; text: string }[];
  writing: { id: string; text: string }[];
  instructions: { id: string; text: string; meaning: string }[];
  vocabulary: { id: string; term: string; meaning: string }[];
  conversation: { id: string; prompt: string; tip: string }[];
};
const KINDS: { kind: Kind; label: string; blurb: string }[] = [
  { kind: "reading", label: "Reading", blurb: "Read one sentence aloud. In the interview you get up to three tries to read one correctly." },
  { kind: "writing", label: "Writing", blurb: "Write the sentence you hear. Spelling that keeps the meaning is what matters." },
  { kind: "instructions", label: "Instructions", blurb: "Understand what the officer asks you to do." },
  { kind: "n400-vocabulary", label: "N-400 words", blurb: "Words from your application that the officer may use." },
  { kind: "conversation", label: "Conversation", blurb: "Practice answering truthfully about your own application. OathSteps never writes answers for you." },
];

export default function InterviewPage() {
  const [kind, setKind] = useState<Kind>("reading");
  const { data, loading } = useData(async () => ({ profile: await getProfile(), history: await listEnglishTasks() }));
  if (loading || !data) return <Spinner />;
  const done = data.history.filter((h) => h.kind === kind);

  return (
    <div className="space-y-4">
      <PageTitle title="Interview English" lead="Speaking is assessed throughout the interview. Reading and writing are one sentence each. Everything here is self-assessed practice." />
      <nav aria-label="English skills" className="flex gap-2 overflow-x-auto pb-1">
        {KINDS.map((k) => (
          <button key={k.kind} type="button" onClick={() => setKind(k.kind)} aria-pressed={kind === k.kind} className={`shrink-0 rounded-full border px-4 py-2 font-medium ${kind === k.kind ? "border-teal bg-teal text-white" : "border-line bg-white text-ink-2"}`}>
            {k.label}
          </button>
        ))}
      </nav>
      <p className="text-ink-2">{KINDS.find((k) => k.kind === kind)?.blurb}</p>
      <p className="text-sm text-ink-3">
        {done.length} completed · self-reported. Sources: {tasks.sources.map((s, i) => (
          <span key={s.url}>
            {i > 0 && ", "}
            <ExternalLink href={s.url}>{s.label}</ExternalLink>
          </span>
        ))}
      </p>
      <TaskRunner key={kind} kind={kind} audioRate={data.profile.audioRate} />
      <Notice tone="info">
        <p>{tasks.review.note}</p>
      </Notice>
    </div>
  );
}

function TaskRunner({ kind, audioRate }: { kind: Kind; audioRate: number }) {
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState("");
  const [recordId, setRecordId] = useState(() => newId());
  const [saved, setSaved] = useState<Outcome | null>(null);

  const list = kind === "reading" ? tasks.reading : kind === "writing" ? tasks.writing : kind === "instructions" ? tasks.instructions : kind === "n400-vocabulary" ? tasks.vocabulary : tasks.conversation;
  const item = list[i % list.length];

  const record = async (outcome: Outcome) => {
    await recordEnglishTask({ id: recordId, kind, taskId: item.id, outcome, selfReported: true, at: nowIso() });
    setSaved(outcome);
  };
  const next = () => {
    setI((x) => x + 1);
    setRevealed(false);
    setTyped("");
    setSaved(null);
    setRecordId(newId());
  };

  const assess = (
    <div className="space-y-2">
      <p className="font-semibold">{kind === "conversation" ? "Could you answer this clearly and truthfully?" : kind === "n400-vocabulary" ? "Did you know what it means?" : "How did it go?"}</p>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="good" size="lg" className="px-2 text-base" disabled={saved !== null} onClick={() => record("correct")}>
          Yes
        </Button>
        <Button variant="warn" size="lg" className="px-2 text-base" disabled={saved !== null} onClick={() => record("uncertain")}>
          Partly
        </Button>
        <Button variant="danger" size="lg" className="px-2 text-base" disabled={saved !== null} onClick={() => record("incorrect")}>
          Not yet
        </Button>
      </div>
      {saved && (
        <div className="flex items-center justify-between" aria-live="polite">
          <Pill tone={saved === "correct" ? "good" : saved === "uncertain" ? "warn" : "bad"}>Saved as self-reported</Pill>
          <Button onClick={next}>Next</Button>
        </div>
      )}
    </div>
  );

  if (kind === "reading") {
    const rd = item as { id: string; text: string };
    return (
      <Card className="space-y-4">
        <p className="text-sm text-ink-3">
          Sentence {(i % list.length) + 1} of {list.length}
        </p>
        <p className="text-2xl font-semibold leading-snug">{rd.text}</p>
        <p className="text-ink-2">Read it aloud. Then listen to compare.</p>
        <SpeakButton text={rd.text} rate={audioRate} label="Listen to the sentence" />
        {assess}
      </Card>
    );
  }
  if (kind === "writing") {
    const wr = item as { id: string; text: string };
    const match = normalize(typed) === normalize(wr.text);
    return (
      <Card className="space-y-4">
        <p className="text-sm text-ink-3">
          Dictation {(i % list.length) + 1} of {list.length}
        </p>
        <SpeakButton text={wr.text} rate={audioRate} label="Hear the sentence" />
        <label htmlFor="dictation" className="block font-semibold">
          Write what you heard
        </label>
        <Input id="dictation" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="sentences" />
        {!revealed ? (
          <Button variant="secondary" onClick={() => setRevealed(true)} disabled={!typed.trim()}>
            Check my sentence
          </Button>
        ) : (
          <div className="space-y-2" aria-live="polite">
            <p className="rounded-xl bg-paper-2 p-3">
              The sentence was: <strong>{wr.text}</strong>
            </p>
            <p className={match ? "text-good" : "text-ink-2"}>{match ? "Your sentence matches word for word." : "Compare your spelling. Small differences that keep the meaning are usually acceptable; judge for yourself."}</p>
            {assess}
          </div>
        )}
      </Card>
    );
  }
  if (kind === "instructions") {
    const ins = item as { id: string; text: string; meaning: string };
    return (
      <Card className="space-y-4">
        <p className="text-sm text-ink-3">
          Instruction {(i % list.length) + 1} of {list.length}
        </p>
        <SpeakButton text={ins.text} rate={audioRate} label="Hear the officer" />
        <p className="text-xl font-semibold">“{ins.text}”</p>
        <p className="text-ink-2">What should you do?</p>
        {!revealed ? (
          <Button variant="secondary" onClick={() => setRevealed(true)}>
            Show what it means
          </Button>
        ) : (
          <div className="space-y-3" aria-live="polite">
            <p className="rounded-xl bg-teal-soft/50 p-3">{ins.meaning}</p>
            {assess}
          </div>
        )}
      </Card>
    );
  }
  if (kind === "n400-vocabulary") {
    const voc = item as { id: string; term: string; meaning: string };
    return (
      <Card className="space-y-4">
        <p className="text-sm text-ink-3">
          Word {(i % list.length) + 1} of {list.length}
        </p>
        <p className="text-2xl font-semibold">{voc.term}</p>
        <SpeakButton text={voc.term} rate={audioRate} />
        {!revealed ? (
          <Button variant="secondary" onClick={() => setRevealed(true)}>
            Show meaning
          </Button>
        ) : (
          <div className="space-y-3" aria-live="polite">
            <p className="rounded-xl bg-teal-soft/50 p-3">{voc.meaning}</p>
            {assess}
          </div>
        )}
      </Card>
    );
  }
  if (kind === "conversation") {
    const conv = item as { id: string; prompt: string; tip: string };
    return (
      <Card className="space-y-4">
        <p className="text-sm text-ink-3">
          Question {(i % list.length) + 1} of {list.length}
        </p>
        <SpeakButton text={conv.prompt} rate={audioRate} label="Hear the question" />
        <p className="text-xl font-semibold">“{conv.prompt}”</p>
        <p className="text-ink-2">Answer out loud with your own true information. Keep it short and clear.</p>
        {!revealed ? (
          <Button variant="secondary" onClick={() => setRevealed(true)}>
            Show a tip
          </Button>
        ) : (
          <div className="space-y-3" aria-live="polite">
            <p className="rounded-xl bg-teal-soft/50 p-3">{conv.tip}</p>
            {assess}
          </div>
        )}
      </Card>
    );
  }
  return null;
}
