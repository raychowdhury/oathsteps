"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { todayDateOnly } from "@/domain/dates";
import { fmtDate, validateFiling, validateInterviewDate } from "@/domain/validation";
import { LOCALES } from "@/i18n";
import { requestPersistentStorage } from "@/lib/install";
import { routeFor } from "@/lib/path";
import { getJourney, getProfile, setChecklist, setJourneySlot, saveProfile } from "@/lib/store/repo";
import { useData } from "@/lib/store/useData";
import { US_STATES } from "@/lib/us-states";
import { Icon } from "@/components/icons";
import { ErrorLine, useToast } from "@/components/Overlay";
import { ExtLink, Steps } from "@/components/Screen";

const LANGS = [
  { v: "en", l: "English", note: "" },
  { v: "es", l: "Español", note: "Spanish · not yet available" },
  { v: "zh", l: "中文", note: "Chinese · not yet available" },
  { v: "vi", l: "Tiếng Việt", note: "Vietnamese · not yet available" },
  { v: "tl", l: "Tagalog", note: "not yet available" },
  { v: "bn", l: "বাংলা", note: "Bengali · not yet available" },
];

export default function SetupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data } = useData(async () => ({ profile: await getProfile(), journey: await getJourney() }), [], { live: false });
  const [step, setStep] = useState(1);
  const [fd, setFd] = useState<{ date: string; unsure: boolean; s6520: boolean; error: string } | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [interview, setInterview] = useState("");
  const [ivErr, setIvErr] = useState("");
  const [saving, setSaving] = useState(false);
  const today = todayDateOnly();
  if (!data) return null;
  const { profile, journey } = data;
  const f = fd ?? { date: profile.filingDate ?? "", unsure: profile.filingDateUnknown, s6520: profile.specialConsideration, error: "" };
  const st = state ?? profile.state ?? "";
  const ivDate = interview || journey.interview.date || "";
  const routePreview = routeFor({ filingDate: !f.unsure && !validateFiling(f, today) ? f.date : null, filingDateUnknown: f.unsure, specialConsideration: f.s6520 });
  const availableLangs = new Set(LOCALES.filter((l) => l.review).map((l) => l.code));

  const next = async () => {
    if (step === 2) {
      const err = validateFiling(f, today);
      if (err) return setFd({ ...f, error: err });
      setStep(3);
      return;
    }
    if (step === 3) {
      const err = validateInterviewDate(ivDate, f.unsure ? null : f.date);
      if (err) return setIvErr(err);
      setStep(4);
      return;
    }
    if (step === 5) {
      setSaving(true);
      await saveProfile({ filingDate: f.unsure ? null : f.date, filingDateUnknown: f.unsure, specialConsideration: f.s6520, state: st || null, onboarded: true });
      void requestPersistentStorage();
      if (ivDate) await setJourneySlot("interview", { status: ivDate >= today ? "scheduled" : "attended", date: ivDate });
      if (!f.unsure && f.date) await setChecklist({ itemId: "path", completedAt: new Date().toISOString(), remind: false });
      toast("You’re set. Your study path is saved on this device.");
      router.push("/");
      return;
    }
    setStep(step + 1);
  };
  const back = () => (step === 1 ? router.push("/") : setStep(step - 1));
  const skip = () => (step === 3 ? (setInterview(""), setIvErr(""), setStep(4)) : setStep(step + 1));

  const summary = [
    { k: "Study language", v: "English", edit: () => setStep(1), aria: "Change study language" },
    { k: "Civics test", v: routePreview.key === "none" ? "Not chosen yet" : `${routePreview.name}${f.date && !f.unsure ? ` · filed ${fmtDate(f.date)}` : ""}`, edit: () => setStep(2), aria: "Change filing date and test" },
    { k: "State or territory", v: st ? (US_STATES.find((s) => s.code === st)?.name ?? st) : "Not added", edit: () => setStep(3), aria: "Change state" },
    { k: "Interview date", v: ivDate ? fmtDate(ivDate) : "Not added", edit: () => setStep(3), aria: "Change interview date" },
  ];

  return (
    <div className="o-shell">
      <header className="o-top">
        <button className="o-iconbtn" type="button" onClick={back} aria-label="Back">
          <Icon name="back" />
        </button>
        <div className="o-grow o-stack-xs" style={{ paddingRight: ".5em" }}>
          <span className="o-meta">Set up · step {step} of 5</span>
          <Steps count={5} current={step - 1} full />
        </div>
      </header>
      <main className="o-main" id="main">
        <div className="o-page o-narrow">
          {step === 1 && (
            <div className="o-stack">
              <h1 className="o-h1">Which language helps you study?</h1>
              <p className="o-help">Questions stay in English, like the interview. Help uses your language.</p>
              <fieldset style={{ border: 0, margin: 0, padding: 0 }} className="o-stack-s">
                <legend className="o-label">Study language</legend>
                {LANGS.map((o) => {
                  const available = availableLangs.has(o.v);
                  return (
                    <label key={o.v} className={`o-opt ${o.v === "en" ? "o-opt-on" : ""} ${available ? "" : "o-opt-off"}`}>
                      <input type="radio" name="setup-lang" value={o.v} checked={o.v === "en"} disabled={!available} readOnly />
                      <span className="o-grow">
                        <span className="o-strong">{o.l}</span> <span className="o-meta">{o.note}</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
              <p className="o-meta">Help is in English only until a reviewed translation is ready.</p>
            </div>
          )}

          {step === 2 && (
            <div className="o-stack">
              <h1 className="o-h1">When did you file Form N-400?</h1>
              <p className="o-help">It decides your civics test. It’s on your receipt notice (I-797C).</p>
              <div>
                <label className="o-label" htmlFor="fd-date">
                  Filing date
                </label>
                <input id="fd-date" className="o-input" type="date" value={f.date} max={today} disabled={f.unsure} aria-invalid={f.error ? "true" : "false"} aria-describedby="fd-err fd-help" onChange={(e) => setFd({ ...f, date: e.target.value, error: e.target.value && (e.target.value > today || e.target.value.length !== 10) ? validateFiling({ date: e.target.value, unsure: false }, today) : "" })} />
                <div id="fd-help" className="o-meta" style={{ marginTop: ".375em" }}>
                  Month, day and year.
                </div>
                {f.error && <ErrorLine id="fd-err">{f.error}</ErrorLine>}
              </div>
              <label className="o-check">
                <input type="checkbox" checked={f.unsure} onChange={() => setFd({ ...f, unsure: !f.unsure, error: "" })} />
                <span>
                  <span className="o-strong">I’m not sure</span>
                </span>
              </label>
              {routePreview.key !== "none" && (
                <div className="o-card o-card-guide" aria-live="polite" data-testid="route-card">
                  <div className="o-meta">Your study path</div>
                  <div className="o-h2">{routePreview.name}</div>
                  <ul className="o-stack-xs">
                    {routePreview.lines.map((l) => (
                      <li key={l} className="o-row">
                        <Icon name="check" small />
                        {l}
                      </li>
                    ))}
                  </ul>
                  <div className="o-help">{routePreview.reason}</div>
                </div>
              )}
              {f.unsure && (
                <div className="o-card o-card-amber" aria-live="polite" data-testid="route-none">
                  <div className="o-row o-strong" style={{ color: "var(--am)" }}>
                    <Icon name="flag" />
                    Test version not chosen yet
                  </div>
                  <div>Before Oct 20, 2025: 2008 test. On or after: 2025 test.</div>
                </div>
              )}
              <p className="o-meta">Rules checked Oct 5, 2026. Confirm before your interview.</p>
            </div>
          )}

          {step === 3 && (
            <div className="o-stack">
              <h1 className="o-h1">Where you live and your interview</h1>
              <p className="o-help">Both optional.</p>
              <div>
                <label className="o-label" htmlFor="su-state">
                  State or territory (optional)
                </label>
                <select id="su-state" className="o-input" value={st} onChange={(e) => setState(e.target.value)}>
                  <option value="">Choose one (optional)</option>
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="o-label" htmlFor="su-int">
                  Interview date (optional)
                </label>
                <input id="su-int" className="o-input" type="date" value={ivDate} aria-invalid={ivErr ? "true" : "false"} aria-describedby="su-int-err" onChange={(e) => (setInterview(e.target.value), setIvErr(""))} />
                {ivErr && <ErrorLine id="su-int-err">{ivErr}</ErrorLine>}
                <div className="o-meta" style={{ marginTop: ".375em" }}>
                  From your interview notice.
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="o-stack">
              <h1 className="o-h1">Exceptions and special consideration</h1>
              <p className="o-help">OathSteps can’t decide if these apply to you.</p>
              <div className="o-card">
                <div className="o-h2">65/20 special consideration</div>
                <div>65+ and a resident 20+ years when you filed: 20 questions, 10 asked, 6 to pass.</div>
                <label className="o-check">
                  <input type="checkbox" checked={f.s6520} onChange={() => setFd({ ...f, s6520: !f.s6520 })} />
                  <span>Use the 65/20 format (my choice)</span>
                </label>
                <ExtLink href="https://www.ecfr.gov/current/title-8/chapter-I/subchapter-C/part-312">8 CFR Part 312: educational requirements</ExtLink>
              </div>
              <div className="o-card">
                <div className="o-h2">English exceptions</div>
                <div>50/20 or 55/15: no English test, civics still required. Disability: Form N-648.</div>
                <ExtLink href="https://www.uscis.gov/sites/default/files/document/fact-sheets/FactSheet_N-648_MedCertForDisabilityExceptions.pdf">USCIS: Form N-648 fact sheet (PDF)</ExtLink>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="o-stack">
              <h1 className="o-h1">Check your study path</h1>
              <p className="o-help">Change anything that looks wrong.</p>
              <div className="o-card" style={{ gap: 0 }}>
                {summary.map((r) => (
                  <div key={r.k} className="o-li">
                    <div className="o-grow">
                      <div className="o-meta">{r.k}</div>
                      <div className="o-strong">{r.v}</div>
                    </div>
                    <button className="o-btn o-btn-g" type="button" onClick={r.edit} aria-label={r.aria}>
                      Change
                    </button>
                  </div>
                ))}
              </div>
              {routePreview.key === "none" && (
                <div className="o-card o-card-amber">
                  <div>Add your filing date later in Settings.</div>
                </div>
              )}
              <p className="o-meta">Saved on this device only.</p>
            </div>
          )}
        </div>
        <div className="o-actions">
          <button className="o-btn o-btn-p o-btn-lg o-btn-block" type="button" onClick={next} disabled={saving} data-testid="setup-next">
            {step === 5 ? "Start practicing" : "Continue"}
          </button>
          {(step === 3 || step === 4) && (
            <button className="o-btn o-btn-g o-btn-block" type="button" onClick={skip}>
              Skip for now
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
