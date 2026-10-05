"use client";
import Link from "next/link";
import { todayDateOnly } from "@/domain/dates";
import { dueToday, isWeak } from "@/domain/scheduler";
import { bankLabel, bankQuestions, pathFor } from "@/lib/path";
import { getOpenMock, getProfile, listBookmarks, listReviewStates } from "@/lib/store/repo";
import { useData } from "@/lib/store/useData";
import { Card, LinkButton, Notice, Spinner } from "@/components/ui";

export default function PracticePage() {
  const { data, loading } = useData(async () => {
    const [profile, reviewStates, bookmarks, openMock] = await Promise.all([getProfile(), listReviewStates(), listBookmarks(), getOpenMock()]);
    return { profile, reviewStates, bookmarks, openMock };
  });
  if (loading || !data) return <Spinner />;
  const { profile, reviewStates, bookmarks, openMock } = data;
  const path = pathFor(profile);
  const questions = bankQuestions(path);
  const ids = new Set(questions.map((q) => q.id));
  const inBank = reviewStates.filter((s) => ids.has(s.questionId));
  const today = todayDateOnly();
  const due = dueToday(inBank, today, 999).due.length;
  const weak = inBank.filter(isWeak).length;
  const seen = inBank.filter((s) => s.seenCount > 0).length;

  if (path.status === "unknown") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Practice</h1>
        <Notice tone="warn" title="Choose your test first">
          <p>
            Practice uses the question bank for your filing date. <Link href="/setup" className="font-semibold underline">Open Setup</Link> to enter it or pick a test provisionally.
          </p>
        </Notice>
      </div>
    );
  }

  const items = [
    { href: "/practice/session?mode=today", title: "Today’s cards", detail: `${due} due · new questions added`, primary: true },
    { href: "/practice/session?mode=review", title: "Review weak answers", detail: `${weak} question${weak === 1 ? "" : "s"} marked weak or unsure`, disabled: weak === 0 },
    { href: "/practice/topics", title: "Browse by topic", detail: `${seen} of ${questions.length} practiced` },
    { href: "/practice/session?mode=mc", title: "Multiple-choice check", detail: "Recognition practice, recorded separately from recall" },
    { href: "/practice/session?mode=bookmarks", title: "Bookmarked questions", detail: `${bookmarks.filter((b) => ids.has(b)).length} saved`, disabled: bookmarks.filter((b) => ids.has(b)).length === 0 },
  ];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Practice</h1>
        <p className="text-ink-2">{bankLabel(path)}</p>
      </header>
      <Card className="space-y-2 border-teal/40">
        <h2 className="text-lg font-semibold">Mock test</h2>
        <p className="text-ink-2">{openMock ? "You have a mock in progress." : "Practice the real interview format with the stopping rule for your test."}</p>
        <LinkButton href="/practice/mock" size="lg" className="w-full" variant={openMock ? "primary" : "secondary"}>
          {openMock ? "Resume mock" : "Start a mock test"}
        </LinkButton>
      </Card>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.href}>
            {it.disabled ? (
              <div className="rounded-2xl border border-line bg-paper-2 p-4 opacity-70" aria-disabled>
                <p className="font-semibold">{it.title}</p>
                <p className="text-sm text-ink-3">{it.detail}</p>
              </div>
            ) : (
              <Link href={it.href as never} className={`block rounded-2xl border p-4 hover:bg-paper-2 ${it.primary ? "border-teal bg-teal-soft/40" : "border-line bg-white"}`}>
                <p className="font-semibold">{it.title}</p>
                <p className="text-sm text-ink-2">{it.detail}</p>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
