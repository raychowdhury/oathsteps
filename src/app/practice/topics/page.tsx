"use client";
import Link from "next/link";
import { topicsFor } from "@/lib/content";
import { bankLabel, pathFor } from "@/lib/path";
import { getProfile, listReviewStates } from "@/lib/store/repo";
import { useData } from "@/lib/store/useData";
import { Meter, Notice, PageTitle, Spinner } from "@/components/ui";

export default function TopicsPage() {
  const { data, loading } = useData(async () => ({ profile: await getProfile(), reviewStates: await listReviewStates() }));
  if (loading || !data) return <Spinner />;
  const path = pathFor(data.profile);
  if (!path.bank)
    return (
      <Notice tone="warn" title="Choose your test first">
        <p>Open Setup to pick a test.</p>
      </Notice>
    );
  const topics = topicsFor(path.bank, path.special);
  const seen = new Set(data.reviewStates.filter((s) => s.seenCount > 0).map((s) => s.questionId));
  const sections = [...new Set(topics.map((t) => t.section))];
  return (
    <div className="space-y-5">
      <PageTitle title="Browse by topic" lead={bankLabel(path)} />
      {sections.map((section) => (
        <section key={section} aria-labelledby={`s-${section}`} className="space-y-2">
          <h2 id={`s-${section}`} className="text-sm font-semibold uppercase tracking-wide text-ink-3">
            {section}
          </h2>
          <ul className="space-y-2">
            {topics
              .filter((t) => t.section === section)
              .map((t) => (
                <li key={t.subsection}>
                  <Link href={{ pathname: "/practice/session", query: { mode: "topic", topic: t.subsection } }} className="block rounded-2xl border border-line bg-white p-4 hover:bg-paper-2">
                    <p className="font-semibold">{t.subsection}</p>
                    <div className="mt-2">
                      <Meter value={t.questionIds.filter((id) => seen.has(id)).length} max={t.questionIds.length} label="Practiced" />
                    </div>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
