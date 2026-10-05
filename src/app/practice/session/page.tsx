"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { todayDateOnly } from "@/domain/dates";
import { buildDailyPlan } from "@/domain/plan";
import { isWeak } from "@/domain/scheduler";
import { randomSeed, seededRng, shuffle } from "@/domain/rng";
import { getPack } from "@/lib/content";
import { bankQuestions, pathFor } from "@/lib/path";
import { getProfile, listBookmarks, listDynamicAnswers, listReviewStates } from "@/lib/store/repo";
import { useData } from "@/lib/store/useData";
import { PracticeSession } from "@/components/PracticeSession";
import { Notice, Spinner } from "@/components/ui";

function SessionInner() {
  const params = useSearchParams();
  const mode = params.get("mode") ?? "today";
  const topic = params.get("topic");
  const [seed] = useState(() => randomSeed());
  const { data, loading } = useData(async () => {
    const [profile, reviewStates, bookmarks, confirmed] = await Promise.all([getProfile(), listReviewStates(), listBookmarks(), listDynamicAnswers()]);
    return { profile, reviewStates, bookmarks, confirmed };
    // A session's question list is fixed when it starts; recording an attempt must not reshuffle it.
  }, [mode, topic], { live: false });
  if (loading || !data) return <Spinner />;
  const { profile, reviewStates, bookmarks, confirmed } = data;
  const path = pathFor(profile);
  if (!path.bank)
    return (
      <Notice tone="warn" title="Choose your test first">
        <p>Open Setup to enter your filing date or pick a test provisionally.</p>
      </Notice>
    );
  const questions = bankQuestions(path);
  const ids = questions.map((q) => q.id);
  const stateById = new Map(reviewStates.map((s) => [s.questionId, s]));
  let selected: string[] = [];
  let title = "Practice";
  let sessionMode: "recall" | "mc" = "recall";
  const today = todayDateOnly();
  switch (mode) {
    case "review": {
      selected = ids.filter((id) => stateById.get(id) && isWeak(stateById.get(id)!));
      title = "Review weak answers";
      break;
    }
    case "mc": {
      selected = shuffle(ids.filter((id) => !questions.find((q) => q.id === id)?.dynamic), seededRng(seed)).slice(0, 10);
      title = "Multiple-choice check";
      sessionMode = "mc";
      break;
    }
    case "bookmarks": {
      selected = ids.filter((id) => bookmarks.includes(id));
      title = "Bookmarked questions";
      break;
    }
    case "topic": {
      selected = ids.filter((id) => questions.find((q) => q.id === id)?.subsection === topic);
      title = topic ?? "Topic";
      break;
    }
    default: {
      const plan = buildDailyPlan({ today, bankQuestionIds: ids, reviewStates, newPerDay: profile.newPerDay, practicalTask: null });
      selected = [...plan.reviewIds, ...plan.newIds];
      title = "Today’s cards";
    }
  }
  const context = mode === "review" ? "review" : mode === "topic" ? "topic" : "practice";
  return <PracticeSession key={`${mode}:${topic}`} questionIds={selected} packVersion={getPack(path.bank).version} mode={sessionMode} context={context} bookmarks={bookmarks} confirmed={confirmed} audioRate={profile.audioRate} title={title} />;
}

export default function SessionPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <SessionInner />
    </Suspense>
  );
}
