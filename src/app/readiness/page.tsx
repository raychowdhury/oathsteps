"use client";
import { computeReadiness } from "@/domain/readiness";
import { bankLabel, bankQuestions, pathFor } from "@/lib/path";
import { getProfile, listAttempts, listDynamicAnswers, listEnglishTasks, listMocks, listReviewStates } from "@/lib/store/repo";
import { useData } from "@/lib/store/useData";
import { Card, EmptyState, LinkButton, Meter, Notice, PageTitle, Spinner } from "@/components/ui";

export default function ReadinessPage() {
  const { data, loading } = useData(async () => {
    const [profile, attempts, reviewStates, mocks, english, confirmed] = await Promise.all([getProfile(), listAttempts(), listReviewStates(), listMocks(), listEnglishTasks(), listDynamicAnswers()]);
    return { profile, attempts, reviewStates, mocks, english, confirmed };
  });
  if (loading || !data) return <Spinner />;
  const path = pathFor(data.profile);
  const questions = bankQuestions(path);
  const confirmedIds = new Set(data.confirmed.map((c) => c.questionId));
  const r = computeReadiness({
    bankQuestionIds: questions.map((q) => q.id),
    attempts: data.attempts,
    reviewStates: data.reviewStates,
    mocks: data.mocks.filter((m) => m.status === "finished" && m.result && m.finishedAt).map((m) => ({ id: m.config.id, finishedAt: m.finishedAt!, result: m.result!, bank: m.config.bank, special: m.config.special })),
    englishTasks: data.english,
    unconfirmedDynamicIds: questions.filter((q) => q.dynamic && !confirmedIds.has(q.id)).map((q) => q.id),
  });

  return (
    <div className="space-y-4">
      <PageTitle title="Readiness" lead={`${bankLabel(path)}. Every indicator below is computed from your stored practice, with its definition. There is no score and no prediction.`} />
      {!r.hasEnoughHistory && (
        <EmptyState title="Not enough history yet" action={<LinkButton href="/practice">Practice now</LinkButton>}>
          Indicators appear after {r.minimumAttempts} recorded attempts. {r.recommendations[0]}
        </EmptyState>
      )}
      {r.hasEnoughHistory && (
        <>
          <Card className="space-y-2">
            <h2 className="text-lg font-semibold">Coverage</h2>
            <Meter value={r.coverage.encountered} max={r.coverage.bankSize} label="Questions practiced at least once" />
            <p className="text-sm text-ink-3">{r.coverage.definition}</p>
          </Card>
          <Card className="space-y-2">
            <h2 className="text-lg font-semibold">Delayed recall without hints</h2>
            <p className="text-3xl font-bold">
              {r.delayedRecall.numerator} <span className="text-lg font-normal text-ink-2">of {r.delayedRecall.denominator}</span>
            </p>
            <p className="text-sm text-ink-2">
              Method: {r.delayedRecall.method}. Delay: at least {r.delayedRecall.delayHours} hours. {r.delayedRecall.lastEvidenceAt ? `Latest evidence ${r.delayedRecall.lastEvidenceAt.slice(0, 10)}.` : "No delayed attempts yet."}
            </p>
            <p className="text-sm text-ink-3">{r.delayedRecall.definition}</p>
          </Card>
          <Card className="space-y-2">
            <h2 className="text-lg font-semibold">Recent mocks</h2>
            {r.recentMocks.items.length === 0 ? (
              <p className="text-ink-2">No mock tests yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {r.recentMocks.items.map((m) => (
                  <li key={m.id} className="py-2">
                    {m.finishedAt.slice(0, 10)}: {m.result.correct} correct of {m.result.attempted} attempted ({m.result.passed ? "reached passing mark" : m.result.reason === "abandoned" ? "ended early" : "did not pass"}), self-assessed{m.special ? ", 65/20 format" : ""}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm text-ink-3">{r.recentMocks.definition}</p>
          </Card>
          <Card className="space-y-2">
            <h2 className="text-lg font-semibold">English tasks (self-reported)</h2>
            <ul className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(r.english.byKind).map(([k, v]) => (
                <li key={k} className="rounded-xl bg-paper-2 p-2">
                  <span className="block font-medium">{k.replace("n400-vocabulary", "N-400 words")}</span>
                  {v.correct} yes of {v.attempted}
                </li>
              ))}
            </ul>
            <p className="text-sm text-ink-3">{r.english.definition}</p>
          </Card>
          <Card className="space-y-2">
            <h2 className="text-lg font-semibold">Needs another attempt</h2>
            <p>
              {r.uncertain.questionIds.length} unsure answer{r.uncertain.questionIds.length === 1 ? "" : "s"}, {r.unconfirmedDynamic.questionIds.length} changing answer{r.unconfirmedDynamic.questionIds.length === 1 ? "" : "s"} not yet confirmed.
            </p>
            <p className="text-sm text-ink-3">
              {r.uncertain.definition} {r.unconfirmedDynamic.definition}
            </p>
          </Card>
        </>
      )}
      <Notice tone="info" title="What to practice next">
        <ul className="list-disc space-y-1 pl-5">
          {r.recommendations.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </Notice>
    </div>
  );
}
