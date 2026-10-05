"use client";
import Link from "next/link";
import { daysBetween, todayDateOnly } from "@/domain/dates";
import { buildDailyPlan } from "@/domain/plan";
import { MILESTONE_LABELS, dueReminders, nextPracticalTask } from "@/lib/journey";
import { bankLabel, bankQuestions, pathFor } from "@/lib/path";
import { useData } from "@/lib/store/useData";
import { getProfile, listAttempts, listChecklist, listMilestones, listReviewStates } from "@/lib/store/repo";
import { Card, LinkButton, Notice, Pill, Spinner } from "@/components/ui";

export default function TodayPage() {
  const { data, loading, error } = useData(async () => {
    const [profile, reviewStates, milestones, checklist, attempts] = await Promise.all([getProfile(), listReviewStates(), listMilestones(), listChecklist(), listAttempts()]);
    return { profile, reviewStates, milestones, checklist, attempts };
  });

  if (loading) return <Spinner />;
  if (error || !data)
    return (
      <Notice tone="bad" title="Local storage is unavailable">
        <p>OathSteps keeps your progress on this device, but the browser blocked storage. Try a normal (non-private) window. Details: {error}</p>
      </Notice>
    );

  const { profile, reviewStates, milestones, checklist, attempts } = data;
  if (!profile.onboarded) return <Welcome />;

  const today = todayDateOnly();
  const path = pathFor(profile);
  const questions = bankQuestions(path);
  const task = nextPracticalTask(milestones, checklist);
  const plan = buildDailyPlan({ today, bankQuestionIds: questions.map((q) => q.id), reviewStates, newPerDay: profile.newPerDay, practicalTask: task ? { itemId: task.item.id, text: task.item.text, stageTitle: task.stage.title } : null });
  const reminders = dueReminders({ profile, milestones, checklist, today, hasDueCards: plan.reviewIds.length > 0 });
  const cards = plan.reviewIds.length + plan.newIds.length;
  const lastAttempt = attempts.at(-1);
  const interviewDays = profile.interviewDate ? daysBetween(today, profile.interviewDate) : null;
  const deadlineDays = profile.studyDeadline ? daysBetween(today, profile.studyDeadline) : null;
  const nextAppt = milestones.filter((m) => m.date && m.date >= today && ["interview", "oath", "retest", "biometrics-attended"].includes(m.kind)).sort((a, b) => a.date!.localeCompare(b.date!))[0];

  return (
    <div className="space-y-4">
      <section className="path-motif rounded-2xl bg-ink px-5 py-6 text-white">
        <p className="text-sm uppercase tracking-wide text-white/70">Today</p>
        <h1 className="mt-1 text-2xl font-bold">{plan.isFirstSession ? "Let’s start your first practice." : attempts.length ? "Welcome back." : "Ready when you are."}</h1>
        <p className="mt-2 text-white/85">
          <Link href="/setup" className="underline decoration-white/40 underline-offset-2">
            {bankLabel(path)}
          </Link>
        </p>
        {path.status === "unknown" && <p className="mt-2 rounded-xl bg-white/10 p-3 text-sm">Set your filing date or choose a test in Setup so practice uses the right questions.</p>}
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {interviewDays !== null && <Pill tone="teal">{interviewDays >= 0 ? `${interviewDays} day${interviewDays === 1 ? "" : "s"} to your interview (${profile.interviewDate})` : `Interview date ${profile.interviewDate} has passed`}</Pill>}
          {deadlineDays !== null && deadlineDays >= 0 && <Pill>{deadlineDays} days to your study goal</Pill>}
          {!profile.interviewDate && nextAppt && <Pill tone="teal">{MILESTONE_LABELS[nextAppt.kind]} on {nextAppt.date}</Pill>}
        </div>
      </section>

      <Card aria-labelledby="plan-h" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 id="plan-h" className="text-lg font-semibold">
            Today’s plan
          </h2>
          <span className="text-sm text-ink-3">about {plan.estimatedMinutes} min</span>
        </div>
        <ul className="space-y-2">
          <li className="flex items-center justify-between rounded-xl bg-paper-2 px-3 py-2">
            <span>Review due answers</span>
            <strong data-testid="due-count">{plan.reviewIds.length}</strong>
          </li>
          <li className="flex items-center justify-between rounded-xl bg-paper-2 px-3 py-2">
            <span>New questions</span>
            <strong data-testid="new-count">{plan.newIds.length}</strong>
          </li>
          <li className="flex items-center justify-between rounded-xl bg-paper-2 px-3 py-2">
            <span>Practical task</span>
            <strong>{task ? 1 : 0}</strong>
          </li>
        </ul>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
          {plan.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {cards > 0 ? (
          <LinkButton href="/practice/session?mode=today" size="lg" className="w-full" data-testid="start-today">
            Start today’s practice
          </LinkButton>
        ) : (
          <LinkButton href="/practice" size="lg" variant="secondary" className="w-full">
            Open Practice
          </LinkButton>
        )}
        {path.status !== "unknown" && plan.deferredReview > 0 && <p className="text-sm text-ink-3">{plan.deferredReview} more reviews are waiting after today’s set. Missed days are fine; they just spread out.</p>}
      </Card>

      {task && (
        <Card aria-labelledby="task-h" className="space-y-2">
          <h2 id="task-h" className="text-lg font-semibold">
            One practical task
          </h2>
          <p className="text-sm text-ink-3">{task.stage.title}</p>
          <p>{task.item.text}</p>
          <p className="text-sm text-ink-2">{task.item.why}</p>
          <LinkButton href={`/journey#${task.item.id}`} variant="secondary" size="sm">
            Open in Journey
          </LinkButton>
        </Card>
      )}

      {reminders.length > 0 && (
        <Card aria-labelledby="rem-h" className="space-y-2">
          <h2 id="rem-h" className="text-lg font-semibold">
            Reminders
          </h2>
          <ul className="space-y-1">
            {reminders.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3">
                <span>{r.title}</span>
                <span className="shrink-0 text-sm text-ink-3">{r.date}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-ink-3">Reminders appear here when you open the app. Export them to your calendar from Journey.</p>
        </Card>
      )}

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Progress so far</p>
          <p className="text-sm text-ink-2">
            {attempts.length} attempt{attempts.length === 1 ? "" : "s"} recorded{lastAttempt ? `, last on ${lastAttempt.at.slice(0, 10)}` : ""}.
          </p>
        </div>
        <LinkButton href="/readiness" variant="secondary" size="sm">
          See readiness
        </LinkButton>
      </Card>
    </div>
  );
}

function Welcome() {
  return (
    <div className="space-y-4">
      <section className="path-motif rounded-2xl bg-ink px-5 py-8 text-white">
        <h1 className="text-3xl font-bold">Practice. Prepare. Track your journey.</h1>
        <p className="mt-3 text-white/85">OathSteps helps you prepare for the U.S. naturalization interview: say civics answers aloud before you see them, practice English tasks, and keep your own checklist and milestones.</p>
        <div className="mt-5">
          <LinkButton href="/setup" size="lg" variant="primary" className="w-full">
            Get started
          </LinkButton>
        </div>
        <p className="mt-3 text-sm text-white/70">No account needed. Your progress stays on this device unless you choose to sync it.</p>
      </section>
      <Card className="space-y-2">
        <h2 className="text-lg font-semibold">What you will find</h2>
        <ul className="list-disc space-y-1 pl-5 text-ink-2">
          <li>The correct civics question bank for your N-400 filing date (2008 or 2025 test).</li>
          <li>Recall-first cards, review scheduling and realistic mock tests.</li>
          <li>Reading, writing and interview-conversation practice.</li>
          <li>A stage-by-stage guide with official links and a manual journey tracker.</li>
        </ul>
        <p className="text-sm text-ink-3">OathSteps is a private study tool. It does not decide eligibility, predict results or replace your USCIS notices.</p>
      </Card>
    </div>
  );
}
