"use client";
import { useState } from "react";
import tasksJson from "../../../../content/english/tasks.json";
import { getProfile } from "@/lib/store/repo";
import { useData } from "@/lib/store/useData";
import { Icon } from "@/components/icons";
import { ListenButton } from "@/components/ListenButton";
import { Screen } from "@/components/Screen";

const T = tasksJson as { vocabulary: { id: string; term: string; meaning: string }[]; conversation: { id: string; prompt: string; tip: string }[] };

export default function N400Page() {
  const { data: profile } = useData(getProfile);
  const [cv, setCv] = useState(0);
  if (!profile) return null;
  const c = T.conversation[cv % T.conversation.length];
  return (
    <Screen title="Interview" tab="interview" back="/interview" showSettings={false}>
      <div className="o-page">
        <div className="o-stack-s">
          <h1 className="o-h1">N-400 words and conversation</h1>
          <p className="o-help">Key words, then practice out loud.</p>
        </div>
        <div className="o-card o-card-amber">
          <div className="o-row o-strong" style={{ color: "var(--am)" }}>
            <Icon name="info" />
            Use your own true information
          </div>
          <div>We don’t suggest, save or check them. Legal questions? Ask a qualified advisor.</div>
        </div>
        <div className="o-cols">
          <section className="o-card" style={{ gap: 0 }}>
            <h2 className="o-h2" style={{ marginBottom: ".5em" }}>
              Words to know
            </h2>
            {T.vocabulary.map((r) => (
              <div key={r.id} className="o-li">
                <div className="o-grow">
                  <div className="o-strong">{r.term}</div>
                  <div className="o-help">{r.meaning}</div>
                </div>
                <ListenButton text={r.term} rate={profile.audioRate} ghost iconOnly />
              </div>
            ))}
          </section>
          <section className="o-card">
            <h2 className="o-h2">Practice a conversation</h2>
            <div className="o-meta">
              Prompt {(cv % T.conversation.length) + 1} of {T.conversation.length}
            </div>
            <div className="o-card o-card-guide" style={{ gap: ".25em" }}>
              <div className="o-meta">The officer might ask</div>
              <div className="o-h2" data-testid="convo-prompt">
                “{c.prompt}”
              </div>
            </div>
            <ListenButton text={c.prompt} rate={profile.audioRate} style={{ alignSelf: "flex-start" }} />
            <div className="o-help">{c.tip}</div>
            <div className="o-actions-2">
              <button className="o-btn o-btn-n" type="button" onClick={() => setCv((cv + T.conversation.length - 1) % T.conversation.length)}>
                Previous
              </button>
              <button className="o-btn o-btn-p" type="button" onClick={() => setCv(cv + 1)} data-testid="convo-next">
                Next prompt
              </button>
            </div>
          </section>
        </div>
      </div>
    </Screen>
  );
}
