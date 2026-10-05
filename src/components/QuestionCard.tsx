"use client";
import { useState } from "react";
import type { MultipleChoice } from "@/domain/answers";
import { todayDateOnly } from "@/domain/dates";
import type { ConfirmedDynamicAnswer, Outcome } from "@/domain/types";
import type { Question } from "@/lib/content";
import { saveDynamicAnswer, saveReport, toggleBookmark } from "@/lib/store/repo";
import { newId, nowIso } from "@/lib/store/events";
import { SpeakButton } from "./SpeakButton";
import { Button, Card, ExternalLink, Field, Input, Notice, Pill } from "./ui";

export interface CardResult {
  outcome: Outcome;
  prompted: boolean;
  method: "self-unprompted" | "self-hinted" | "multiple-choice";
}

export function QuestionCard({
  question,
  packVersion,
  bookmarked,
  confirmed,
  multipleChoice,
  audioRate,
  position,
  onResult,
  busy,
}: {
  question: Question;
  packVersion: string;
  bookmarked: boolean;
  confirmed: ConfirmedDynamicAnswer | null;
  multipleChoice: MultipleChoice | null;
  audioRate: number;
  position?: { index: number; total: number };
  onResult: (r: CardResult) => void;
  busy: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const [hinted, setHinted] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportDone, setReportDone] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const isMc = multipleChoice !== null;
  const firstAnswer = question.answers[0]?.text ?? "";
  const hint = firstAnswer
    .split(" ")
    .map((w) => (/^[A-Za-z]/.test(w) ? w[0] + "…" : w))
    .join(" ");
  const unresolvedDynamic = Boolean(question.dynamic) && !confirmed;

  const assess = (outcome: Outcome) => {
    onResult({ outcome, prompted: hinted, method: hinted ? "self-hinted" : "self-unprompted" });
  };

  const pickChoice = (opt: string) => {
    if (choice || !multipleChoice) return;
    setChoice(opt);
    setRevealed(true);
  };

  const submitReport = async () => {
    if (!reportText.trim()) return;
    await saveReport({ id: newId(), questionId: question.id, packVersion, message: reportText.trim().slice(0, 1000), createdAt: nowIso() });
    setReportDone(true);
    setReporting(false);
    setReportText("");
  };

  return (
    <Card as="article" aria-labelledby={`q-${question.id}`} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="teal">{question.subsection}</Pill>
          <span className="text-sm text-ink-3">
            {question.bank} test · Q{question.number}
            {question.special && " · 65/20"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {position && (
            <span className="text-sm text-ink-3" aria-live="polite">
              {position.index + 1} of {position.total}
            </span>
          )}
          <button type="button" onClick={() => toggleBookmark(question.id)} aria-pressed={bookmarked} aria-label={bookmarked ? "Remove bookmark" : "Bookmark this question"} className="rounded-lg px-2 py-1 text-xl leading-none text-teal-2 hover:bg-teal-soft">
            {bookmarked ? "★" : "☆"}
          </button>
        </div>
      </div>

      <h2 id={`q-${question.id}`} className="text-xl font-semibold leading-snug">
        {question.prompt}
      </h2>
      {question.note && <p className="text-sm text-ink-2">{question.note}</p>}
      <SpeakButton text={question.prompt} rate={audioRate} label="Listen to the question" />

      {question.dynamic && (
        <Notice tone={confirmed ? "good" : "warn"} title={confirmed ? "Your confirmed answer" : "This answer changes"}>
          {confirmed ? (
            <p>
              <strong>{confirmed.answer}</strong> <span className="text-sm">({confirmed.region}, checked {confirmed.confirmedOn})</span>{" "}
              <button type="button" className="text-sm underline" onClick={() => setShowConfirm(true)}>
                Update
              </button>
            </p>
          ) : (
            <p>
              The correct answer depends on current officials or where you live. <ExternalLink href={question.dynamic.lookupUrl}>{question.dynamic.lookupLabel}</ExternalLink>, then record what you found.{" "}
              <button type="button" className="font-semibold underline" onClick={() => setShowConfirm(true)}>
                Record my answer
              </button>
            </p>
          )}
          {showConfirm && <ConfirmDynamicForm question={question} initial={confirmed} onDone={() => setShowConfirm(false)} />}
        </Notice>
      )}

      {!isMc && !revealed && (
        <div className="space-y-3">
          <p className="text-ink-2">Say your answer out loud first. Then check.</p>
          {hinted && (
            <p className="rounded-xl bg-paper-2 px-3 py-2 font-mono text-ink-2" aria-live="polite">
              Hint: {hint}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="lg" onClick={() => setRevealed(true)} className="flex-1">
              Show answer
            </Button>
            {!hinted && (
              <Button type="button" variant="ghost" onClick={() => setHinted(true)}>
                Need a hint
              </Button>
            )}
          </div>
        </div>
      )}

      {isMc && (
        <fieldset className="space-y-2">
          <legend className="text-ink-2">Choose the answer. This counts as recognition, not recall.</legend>
          {multipleChoice.options.map((opt) => {
            const isCorrect = opt === multipleChoice.correct;
            const picked = choice === opt;
            const tone = !choice ? "border-line bg-white hover:bg-paper-2" : isCorrect ? "border-good bg-good-soft" : picked ? "border-bad bg-bad-soft" : "border-line bg-white opacity-70";
            return (
              <button key={opt} type="button" disabled={Boolean(choice)} onClick={() => pickChoice(opt)} aria-pressed={picked} className={`block min-h-12 w-full rounded-xl border px-4 py-2 text-left ${tone}`}>
                {opt}
                {choice && isCorrect && <span className="ml-2 text-sm font-semibold text-good">correct</span>}
              </button>
            );
          })}
        </fieldset>
      )}

      {revealed && (
        <div className="space-y-3" aria-live="polite">
          <div className="rounded-xl border border-teal/30 bg-teal-soft/50 p-3">
            <p className="text-sm font-semibold text-teal-2">{question.requiredCount > 1 ? `Accepted answers (give ${question.requiredCount})` : question.answers.length > 1 ? "Accepted answers (any one)" : "Accepted answer"}</p>
            <ul className="mt-1 space-y-1">
              {question.answers.map((a, i) => (
                <li key={i} className="text-lg">
                  {a.text}
                  {a.note && <span className="block text-sm text-ink-2">{a.note}</span>}
                </li>
              ))}
            </ul>
            <div className="mt-2">
              <SpeakButton text={question.answers.map((a) => a.text).join(". ")} rate={audioRate} label="Listen to the answer" />
            </div>
          </div>
          {unresolvedDynamic && (
            <p className="text-sm text-warn" role="note">
              Because this answer is not confirmed yet, it will be recorded as practiced but not counted toward mastery.
            </p>
          )}
          {isMc ? (
            <Button type="button" size="lg" className="w-full" disabled={busy} onClick={() => onResult({ outcome: choice === multipleChoice.correct ? "correct" : "incorrect", prompted: true, method: "multiple-choice" })}>
              Next
            </Button>
          ) : (
            <div>
              <p className="mb-2 font-semibold">How did you do?</p>
              <div className="grid grid-cols-3 gap-2">
                <Button type="button" variant="good" size="lg" className="px-2 text-base" disabled={busy} onClick={() => assess("correct")}>
                  Got it
                </Button>
                <Button type="button" variant="warn" size="lg" className="px-2 text-base" disabled={busy} onClick={() => assess("uncertain")}>
                  Unsure
                </Button>
                <Button type="button" variant="danger" size="lg" className="px-2 text-base" disabled={busy} onClick={() => assess("incorrect")}>
                  Missed
                </Button>
              </div>
              {hinted && <p className="mt-2 text-sm text-ink-3">You used a hint, so this attempt is recorded as hinted recall.</p>}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm text-ink-3">
        <span>Official wording · pack {packVersion}</span>
        {reportDone ? (
          <span className="text-good">Thanks, your report is saved and included in your export.</span>
        ) : (
          <button type="button" className="underline" onClick={() => setReporting((r) => !r)}>
            Report a problem with this answer
          </button>
        )}
      </div>
      {reporting && (
        <div className="space-y-2">
          <label htmlFor={`report-${question.id}`} className="block text-sm font-semibold">
            What looks wrong?
          </label>
          <textarea id={`report-${question.id}`} value={reportText} onChange={(e) => setReportText(e.target.value)} rows={3} className="w-full rounded-xl border border-line p-3" />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={submitReport} disabled={!reportText.trim()}>
              Save report
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setReporting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function ConfirmDynamicForm({ question, initial, onDone }: { question: Question; initial: ConfirmedDynamicAnswer | null; onDone: () => void }) {
  const [answer, setAnswer] = useState(initial?.answer ?? "");
  const [region, setRegion] = useState(initial?.region ?? (question.dynamic?.scope === "federal" ? "United States" : ""));
  const [date, setDate] = useState(initial?.confirmedOn ?? todayDateOnly());
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || !region.trim()) return;
    await saveDynamicAnswer({ questionId: question.id, answer: answer.trim(), region: region.trim(), confirmedOn: date, sourceUrl: question.dynamic?.lookupUrl ?? "" });
    onDone();
  };
  return (
    <form onSubmit={save} className="mt-3 space-y-3 rounded-xl bg-white p-3">
      <Field id={`dyn-answer-${question.id}`} label="Answer you confirmed">
        <Input id={`dyn-answer-${question.id}`} value={answer} onChange={(e) => setAnswer(e.target.value)} required />
      </Field>
      <Field id={`dyn-region-${question.id}`} label={question.dynamic?.scope === "district" ? "Your state and district" : question.dynamic?.scope === "state" ? "Your state or territory" : "Applies to"}>
        <Input id={`dyn-region-${question.id}`} value={region} onChange={(e) => setRegion(e.target.value)} required />
      </Field>
      <Field id={`dyn-date-${question.id}`} label="Date you checked">
        <Input id={`dyn-date-${question.id}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
