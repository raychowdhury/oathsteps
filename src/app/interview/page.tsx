"use client";
import Link from "next/link";
import tasksJson from "../../../content/english/tasks.json";
import { fmtLocalDay } from "@/domain/validation";
import { useData } from "@/lib/store/useData";
import { lastEnglish, loadSnapshot } from "@/lib/today";
import { Icon, type IconName } from "@/components/icons";
import { ExtLink, Screen } from "@/components/Screen";

const tasks = tasksJson as { instructions: unknown[]; vocabulary: unknown[]; conversation: unknown[] };

export default function InterviewPage() {
  const { data: s } = useData(loadSnapshot);
  if (!s) return null;
  const rd = lastEnglish(s, "reading");
  const wr = lastEnglish(s, "writing");
  const rows: { title: string; sub: string; meta: string; icon: IconName; href: string }[] = [
    { title: "Civics out loud", sub: "Voice optional", meta: "5 questions from your list", icon: "mic", href: "/interview/voice" },
    { title: "Reading", sub: "Read one sentence aloud", meta: rd ? `Last practiced ${fmtLocalDay(rd.at)}` : "Not practiced yet", icon: "guide", href: "/interview/reading" },
    { title: "Writing", sub: "Write one sentence you hear", meta: wr ? `Last practiced ${fmtLocalDay(wr.at)}` : "Not practiced yet", icon: "pencil", href: "/interview/writing" },
    { title: "Interview instructions", sub: "What the officer may say", meta: `${tasks.instructions.length} common phrases`, icon: "interview", href: "/interview/instructions" },
    { title: "N-400 words and conversation", sub: "Key words, truthful answers", meta: `${tasks.vocabulary.length} words · ${tasks.conversation.length} prompts`, icon: "doc", href: "/interview/n400" },
  ];
  return (
    <Screen title="OathSteps" tab="interview" demo={s.demo}>
      <div className="o-page">
        <div className="o-stack-s">
          <h1 className="o-h1">Interview practice</h1>
          <p className="o-help">Civics, reading, writing and listening.</p>
        </div>
        <div className="o-cols">
          <div className="o-stack">
            <section className="o-card" style={{ gap: 0 }}>
              {rows.map((r) => (
                <Link key={r.href} href={r.href as never} className="o-libtn">
                  <span className="o-ic-tile">
                    <Icon name={r.icon} />
                  </span>
                  <span className="o-grow">
                    <span className="o-strong" style={{ display: "block" }}>
                      {r.title}
                    </span>
                    <span className="o-help" style={{ display: "block" }}>
                      {r.sub}
                    </span>
                    <span className="o-meta">{r.meta}</span>
                  </span>
                  <Icon name="chevronRight" />
                </Link>
              ))}
            </section>
          </div>
          <div className="o-stack">
            <div className="o-card o-card-guide">
              <div className="o-row o-strong">
                <Icon name="info" />
                Always answer truthfully
              </div>
              <div>Use your own true answers. We never suggest them.</div>
            </div>
            <section className="o-card">
              <h2 className="o-h2">English at the interview</h2>
              <ul className="o-stack-s">
                <li>
                  <span className="o-strong">Reading:</span> 1 of up to 3 sentences
                </li>
                <li>
                  <span className="o-strong">Writing:</span> 1 of up to 3 sentences
                </li>
                <li>
                  <span className="o-strong">Speaking:</span> throughout the interview
                </li>
              </ul>
              <ExtLink href="https://www.uscis.gov/sites/default/files/document/guides/test_components.pdf">USCIS: Test components (PDF)</ExtLink>
            </section>
            {s.sessions > 0 && (
              <div className="o-card o-card-plain">
                <div className="o-sec-h">
                  <div className="o-strong">Coach pass</div>
                  <span className="o-meta">Proposed · optional</span>
                </div>
                <div className="o-help">Guided mocks and voice feedback, 90 days.</div>
                <Link href="/interview/coach" className="o-btn o-btn-g" style={{ alignSelf: "flex-start" }}>
                  Learn more
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </Screen>
  );
}
