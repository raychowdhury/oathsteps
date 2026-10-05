"use client";
import Link from "next/link";
import { useState } from "react";
import { abandonMock, answerMock, createMock, currentQuestionId, describeRules, pauseMock, resumeMock, startMock, type MockState } from "@/domain/mock";
import { randomSeed } from "@/domain/rng";
import type { Outcome, PracticeAttempt } from "@/domain/types";
import { getPack, getQuestion } from "@/lib/content";
import { bankLabel, bankQuestions, pathFor } from "@/lib/path";
import { getOpenMock, getProfile, listBookmarks, listDynamicAnswers, listMocks, recordAttempt, saveMock } from "@/lib/store/repo";
import { newId, nowIso } from "@/lib/store/events";
import { useData } from "@/lib/store/useData";
import { QuestionCard, type CardResult } from "@/components/QuestionCard";
import { Button, Card, LinkButton, Notice, PageTitle, Pill, Spinner } from "@/components/ui";

export default function MockPage() {
  const { data, loading } = useData(async () => {
    const [profile, open, mocks, bookmarks, confirmed] = await Promise.all([getProfile(), getOpenMock(), listMocks(), listBookmarks(), listDynamicAnswers()]);
    return { profile, open, mocks, bookmarks, confirmed };
  });
  const [attemptId, setAttemptId] = useState(() => newId());
  const [busy, setBusy] = useState(false);
  const [justFinished, setJustFinished] = useState<MockState | null>(null);

  if (loading || !data) return <Spinner />;
  const { profile, open, mocks, bookmarks, confirmed } = data;
  const path = pathFor(profile);
  if (!path.bank)
    return (
      <Notice tone="warn" title="Choose your test first">
        <p>
          A mock needs your test version. <Link href="/setup" className="font-semibold underline">Open Setup</Link>.
        </p>
      </Notice>
    );
  const bank = path.bank;
  const pack = getPack(bank);
  const confirmedIds = new Set(confirmed.map((c) => c.questionId));
  const pool = bankQuestions(path).map((q) => ({ id: q.id, special: q.special, unscorable: Boolean(q.dynamic) && !confirmedIds.has(q.id) }));
  const unscorable = pool.filter((p) => p.unscorable).length;

  const begin = async () => {
    const state = startMock(createMock({ id: newId(), bank, packVersion: pack.version, special: path.special, pool, seed: randomSeed(), now: nowIso() }), nowIso());
    await saveMock(state);
    setAttemptId(newId());
  };

  const onResult = async (state: MockState, r: CardResult) => {
    if (busy) return;
    setBusy(true);
    const qid = currentQuestionId(state)!;
    const at = nowIso();
    const attempt: PracticeAttempt = { id: attemptId, questionId: qid, bank, packVersion: pack.version, outcome: r.outcome, method: "mock-self", prompted: r.prompted, context: "mock", mockId: state.config.id, at };
    await recordAttempt(attempt);
    const next = answerMock(state, { outcome: r.outcome, method: "mock-self", prompted: r.prompted, at });
    await saveMock(next);
    if (next.status === "finished") setJustFinished(next);
    setAttemptId(newId());
    setBusy(false);
  };

  const finished = justFinished ?? null;
  if (finished?.result) return <Results state={finished} onClose={() => setJustFinished(null)} />;

  if (open) {
    const qid = currentQuestionId(open);
    const q = qid ? getQuestion(qid) : null;
    if (open.status === "paused") {
      return (
        <Card className="space-y-3">
          <h1 className="text-xl font-bold">Mock paused</h1>
          <p className="text-ink-2">
            {open.answers.length} of up to {open.config.rules.asked} answered.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => saveMock(resumeMock(open))}>Resume</Button>
            <Button variant="danger" onClick={() => saveMock(abandonMock(open, nowIso()))}>
              End and keep results
            </Button>
          </div>
        </Card>
      );
    }
    if (!q) return <Spinner />;
    const correct = open.answers.filter((a) => a.outcome === "correct").length;
    const notCorrect = open.answers.length - correct;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">Mock test</h1>
          <Button variant="ghost" size="sm" onClick={() => saveMock(pauseMock(open))}>
            Pause
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Pill tone="good">{correct} correct</Pill>
          <Pill tone="bad">{notCorrect} not correct</Pill>
          <Pill>
            question {open.index + 1} of up to {open.config.rules.asked}
          </Pill>
        </div>
        <QuestionCard key={attemptId} question={q} packVersion={pack.version} bookmarked={bookmarks.includes(q.id)} confirmed={confirmed.find((c) => c.questionId === q.id) ?? null} multipleChoice={null} audioRate={profile.audioRate} onResult={(r) => onResult(open, r)} busy={busy} />
      </div>
    );
  }

  const past = mocks.filter((m) => m.status === "finished" && m.result).sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""));
  return (
    <div className="space-y-4">
      <PageTitle title="Mock test" lead={bankLabel(path)} />
      <Card className="space-y-3">
        <p>{describeRules(bank, path.special)}</p>
        <p className="text-sm text-ink-2">You answer out loud and judge yourself, as in recall practice. The result shows exactly what you attempted. It is a practice result, not a prediction.</p>
        {unscorable > 0 && (
          <Notice tone="warn">
            <p>
              {unscorable} question{unscorable === 1 ? "" : "s"} with changing answers {unscorable === 1 ? "is" : "are"} left out until you confirm {unscorable === 1 ? "it" : "them"} from an official source. Find them under Practice → Browse by topic.
            </p>
          </Notice>
        )}
        <Button size="lg" className="w-full" onClick={begin} data-testid="start-mock">
          Start mock
        </Button>
      </Card>
      {past.length > 0 && (
        <Card className="space-y-2">
          <h2 className="text-lg font-semibold">Past mocks</h2>
          <ul className="divide-y divide-line">
            {past.slice(0, 10).map((m) => (
              <li key={m.config.id} className="flex items-center justify-between py-2">
                <span>
                  {m.finishedAt?.slice(0, 10)} · {m.result!.correct}/{m.result!.attempted} correct
                  {m.config.special && " · 65/20"}
                </span>
                <Pill tone={m.result!.passed ? "good" : m.result!.reason === "abandoned" ? "neutral" : "bad"}>{m.result!.passed ? "passed" : m.result!.reason === "abandoned" ? "ended early" : "not passed"}</Pill>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Results({ state, onClose }: { state: MockState; onClose: () => void }) {
  const r = state.result!;
  const missed = r.missedQuestionIds.map((id) => getQuestion(id)).filter(Boolean);
  return (
    <div className="space-y-4" data-testid="mock-results">
      <Card className="space-y-3">
        <h1 className="text-2xl font-bold">{r.passed ? "You reached the passing mark" : r.reason === "abandoned" ? "Mock ended early" : "Not this time"}</h1>
        <p className="text-ink-2">
          {r.attempted} question{r.attempted === 1 ? "" : "s"} attempted of up to {r.asked}. {r.correct} correct, {r.incorrect} incorrect{r.uncertain ? `, ${r.uncertain} unsure (counted as not correct)` : ""}. Passing needs {r.pass} correct.
          {r.stoppedEarly && r.reason !== "abandoned" && " The practice stopped as soon as the outcome was decided, like the real interview."}
        </p>
        <p className="text-sm text-ink-3">Self-assessed on {state.finishedAt?.slice(0, 10)}. This is a practice result in the official format, not a prediction of your interview.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onClose}>Done</Button>
          <LinkButton href="/readiness" variant="secondary">
            See readiness
          </LinkButton>
        </div>
      </Card>
      {missed.length > 0 && (
        <Card className="space-y-2">
          <h2 className="text-lg font-semibold">Review what you missed</h2>
          <ul className="space-y-2">
            {missed.map((q) => (
              <li key={q!.id} className="rounded-xl bg-paper-2 p-3">
                <p className="font-medium">{q!.prompt}</p>
                <p className="text-sm text-ink-2">{q!.answers.map((a) => a.text).join(" · ")}</p>
              </li>
            ))}
          </ul>
          <p className="text-sm text-ink-3">These answers are now due sooner in your review schedule.</p>
        </Card>
      )}
    </div>
  );
}

export type { Outcome };
