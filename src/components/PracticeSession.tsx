"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { buildMultipleChoice } from "@/domain/answers";
import { seededRng } from "@/domain/rng";
import type { ConfirmedDynamicAnswer, Outcome, PracticeAttempt, PracticeContext } from "@/domain/types";
import { getQuestion, questionsFor, type Question } from "@/lib/content";
import { recordAttempt } from "@/lib/store/repo";
import { newId, nowIso } from "@/lib/store/events";
import { QuestionCard, type CardResult } from "./QuestionCard";
import { Button, Card, LinkButton, Meter } from "./ui";

function hashId(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function PracticeSession({
  questionIds,
  packVersion,
  mode,
  context,
  bookmarks,
  confirmed,
  audioRate,
  title,
  doneHref = "/",
}: {
  questionIds: string[];
  packVersion: string;
  mode: "recall" | "mc";
  context: PracticeContext;
  bookmarks: string[];
  confirmed: ConfirmedDynamicAnswer[];
  audioRate: number;
  title: string;
  doneHref?: string;
}) {
  const [index, setIndex] = useState(0);
  const [attemptId, setAttemptId] = useState(() => newId());
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ questionId: string; outcome: Outcome; prompted: boolean }[]>([]);

  const questions = useMemo(() => questionIds.map((id) => getQuestion(id)).filter((q): q is Question => Boolean(q)), [questionIds]);
  const question = questions[index];
  const pool = useMemo(() => (question ? questionsFor(question.bank, false) : []), [question]);
  const mc = useMemo(() => (mode === "mc" && question ? buildMultipleChoice(question, pool, seededRng(hashId(question.id + attemptId))) : null), [mode, question, pool, attemptId]);

  const onResult = async (r: CardResult) => {
    if (!question || busy) return;
    setBusy(true);
    const unresolvedDynamic = Boolean(question.dynamic) && !confirmed.some((c) => c.questionId === question.id);
    const attempt: PracticeAttempt = {
      id: attemptId,
      questionId: question.id,
      bank: question.bank,
      packVersion,
      outcome: r.outcome,
      // An unconfirmed dynamic answer cannot be independently verified; record it as prompted so it never advances mastery.
      method: unresolvedDynamic && r.method === "self-unprompted" ? "self-hinted" : r.method,
      prompted: r.prompted || unresolvedDynamic,
      context,
      at: nowIso(),
    };
    await recordAttempt(attempt);
    setResults((rs) => [...rs, { questionId: question.id, outcome: r.outcome, prompted: attempt.prompted }]);
    setIndex((i) => i + 1);
    setAttemptId(newId());
    setBusy(false);
  };

  if (!questions.length) {
    return (
      <Card className="text-center">
        <p className="text-lg font-semibold">Nothing to practice here right now.</p>
        <div className="mt-3">
          <LinkButton href="/practice" variant="secondary">
            Back to Practice
          </LinkButton>
        </div>
      </Card>
    );
  }

  if (!question) {
    const correct = results.filter((r) => r.outcome === "correct" && !r.prompted).length;
    const hintedCorrect = results.filter((r) => r.outcome === "correct" && r.prompted).length;
    const uncertain = results.filter((r) => r.outcome === "uncertain").length;
    const missed = results.filter((r) => r.outcome === "incorrect").length;
    return (
      <Card className="space-y-4" aria-labelledby="done-h">
        <h2 id="done-h" className="text-xl font-bold">
          Session complete
        </h2>
        <p className="text-ink-2">
          You worked through {results.length} question{results.length === 1 ? "" : "s"}. Here is what you did, not a score.
        </p>
        <ul className="grid grid-cols-2 gap-2 text-center">
          <li className="rounded-xl bg-good-soft p-3">
            <span className="block text-2xl font-bold text-good">{correct}</span>
            <span className="text-sm">recalled without help</span>
          </li>
          <li className="rounded-xl bg-paper-2 p-3">
            <span className="block text-2xl font-bold">{hintedCorrect}</span>
            <span className="text-sm">{mode === "mc" ? "recognized" : "got with a hint"}</span>
          </li>
          <li className="rounded-xl bg-warn-soft p-3">
            <span className="block text-2xl font-bold text-warn">{uncertain}</span>
            <span className="text-sm">not sure</span>
          </li>
          <li className="rounded-xl bg-bad-soft p-3">
            <span className="block text-2xl font-bold text-bad">{missed}</span>
            <span className="text-sm">missed</span>
          </li>
        </ul>
        {(uncertain || missed) > 0 && <p className="text-ink-2">Missed and unsure answers come back sooner in your review schedule.</p>}
        <div className="flex flex-wrap gap-2">
          <LinkButton href={doneHref}>Back to Today</LinkButton>
          <LinkButton href="/practice" variant="secondary">
            More practice
          </LinkButton>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">{title}</h1>
        <Link href="/practice" className="text-sm font-medium text-ink-3 underline">
          Exit
        </Link>
      </div>
      <Meter value={index} max={questions.length} label="Progress" />
      <QuestionCard key={attemptId} question={question} packVersion={packVersion} bookmarked={bookmarks.includes(question.id)} confirmed={confirmed.find((c) => c.questionId === question.id) ?? null} multipleChoice={mc} audioRate={audioRate} position={{ index, total: questions.length }} onResult={onResult} busy={busy} />
      {busy && (
        <p role="status" className="text-center text-sm text-ink-3">
          Saving…
        </p>
      )}
      <div className="text-center">
        <Button type="button" variant="ghost" size="sm" onClick={() => setIndex(questions.length)}>
          Finish early
        </Button>
      </div>
    </div>
  );
}
