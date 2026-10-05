"use client";
import tasksJson from "../../../../content/english/tasks.json";
import { getProfile } from "@/lib/store/repo";
import { useData } from "@/lib/store/useData";
import { ListenButton } from "@/components/ListenButton";
import { Screen } from "@/components/Screen";

const ROWS = (tasksJson as { instructions: { id: string; text: string; meaning: string }[] }).instructions;

export default function InstructionsPage() {
  const { data: profile } = useData(getProfile);
  if (!profile) return null;
  return (
    <Screen title="Interview" tab="interview" back="/interview" showSettings={false}>
      <div className="o-page o-narrow">
        <div className="o-stack-s">
          <h1 className="o-h1">Interview instructions</h1>
          <p className="o-help">Common things an officer says.</p>
        </div>
        <section className="o-card" style={{ gap: 0 }}>
          {ROWS.map((r) => (
            <div key={r.id} className="o-li" style={{ alignItems: "flex-start" }}>
              <div className="o-grow">
                <div className="o-strong">“{r.text}”</div>
                <div className="o-help">{r.meaning}</div>
              </div>
              <ListenButton text={r.text} rate={profile.audioRate} ghost iconOnly />
            </div>
          ))}
        </section>
        <div className="o-card o-card-guide">
          <div className="o-strong">It’s okay to ask</div>
          <div>“Could you repeat that, please?”</div>
        </div>
      </div>
    </Screen>
  );
}
