"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isValidDateOnly, todayDateOnly } from "@/domain/dates";
import { describeSpecialConsideration, resolveTestPath } from "@/domain/testPath";
import type { Bank, StudyProfile } from "@/domain/types";
import { getProfile, saveProfile } from "@/lib/store/repo";
import { US_STATES } from "@/lib/us-states";
import { Button, Card, ExternalLink, Field, Input, Notice, PageTitle, Select } from "@/components/ui";

export default function SetupPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<StudyProfile | null>(null);
  const [filingDate, setFilingDate] = useState("");
  const [unknown, setUnknown] = useState(false);
  const [provisional, setProvisional] = useState<Bank | "">("");
  const [special, setSpecial] = useState(false);
  const [state, setState] = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getProfile().then((p) => {
      setProfile(p);
      setFilingDate(p.filingDate ?? "");
      setUnknown(p.filingDateUnknown);
      setProvisional(p.provisionalBank ?? "");
      setSpecial(p.specialConsideration);
      setState(p.state ?? "");
      setInterviewDate(p.interviewDate ?? "");
      setDeadline(p.studyDeadline ?? "");
    });
  }, []);

  const path = resolveTestPath({ filingDate: !unknown && isValidDateOnly(filingDate) ? filingDate : null, provisionalBank: unknown && provisional ? provisional : null, specialConsideration: special });
  const today = todayDateOnly();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!unknown && !isValidDateOnly(filingDate)) return setError("Enter your filing date as a full calendar date, or choose “I’m not sure”.");
    if (!unknown && filingDate > today) return setError("The filing date cannot be in the future.");
    if (unknown && !provisional) return setError("Choose which test to study for now. You can change this later in Settings.");
    if (interviewDate && !isValidDateOnly(interviewDate)) return setError("The interview date is not a valid date.");
    if (deadline && !isValidDateOnly(deadline)) return setError("The study deadline is not a valid date.");
    setSaving(true);
    await saveProfile({
      filingDate: unknown ? null : filingDate,
      filingDateUnknown: unknown,
      provisionalBank: unknown ? (provisional as Bank) : null,
      specialConsideration: special,
      state: state || null,
      interviewDate: interviewDate || null,
      studyDeadline: deadline || null,
      onboarded: true,
    });
    router.push("/");
  };

  if (!profile) return null;

  return (
    <form onSubmit={submit} className="space-y-5" aria-describedby="setup-intro">
      <PageTitle title={profile.onboarded ? "Your study setup" : "Welcome to OathSteps"} lead={<span id="setup-intro">A few details choose the right civics test and shape your daily plan. You can study as a guest; nothing here needs an account.</span>} />

      <Card className="space-y-4" aria-labelledby="filing-h">
        <h2 id="filing-h" className="text-lg font-semibold">
          When was your Form N-400 filed?
        </h2>
        <p className="text-ink-2">The filing date, not your interview date, decides which civics test you take.</p>
        <Field id="filingDate" label="Filing date" hint="Shown on your receipt notice (Form I-797C).">
          <Input id="filingDate" type="date" value={filingDate} max={today} disabled={unknown} onChange={(e) => setFilingDate(e.target.value)} aria-describedby="filingDate-hint" />
        </Field>
        <label className="flex items-start gap-3 rounded-xl border border-line p-3">
          <input type="checkbox" className="mt-1 h-5 w-5" checked={unknown} onChange={(e) => setUnknown(e.target.checked)} />
          <span>
            <span className="font-semibold">I’m not sure / I have not filed yet</span>
            <span className="block text-sm text-ink-2">We will not guess. Pick a test to study for now and confirm your date later.</span>
          </span>
        </label>
        {unknown && (
          <Field id="provisional" label="Which test do you want to study for now?" hint="Filed before October 20, 2025 → 2008 test. Filed on or after → 2025 test. If you have not filed yet, the 2025 test will apply.">
            <Select id="provisional" value={provisional} onChange={(e) => setProvisional(e.target.value as Bank | "")} aria-describedby="provisional-hint">
              <option value="">Choose…</option>
              <option value="2025">2025 civics test (128 questions)</option>
              <option value="2008">2008 civics test (100 questions)</option>
            </Select>
          </Field>
        )}
        <Notice tone={path.status === "unknown" ? "warn" : "info"} title={path.status === "unknown" ? "Test version not set yet" : path.status === "provisional" ? "Provisional choice" : "Your civics test"}>
          <p data-testid="path-explanation">{path.explanation}</p>
        </Notice>
      </Card>

      <Card className="space-y-3" aria-labelledby="special-h">
        <h2 id="special-h" className="text-lg font-semibold">
          65/20 special consideration
        </h2>
        <p className="text-ink-2">{describeSpecialConsideration()}</p>
        <label className="flex items-start gap-3 rounded-xl border border-line p-3">
          <input type="checkbox" className="mt-1 h-5 w-5" checked={special} onChange={(e) => setSpecial(e.target.checked)} />
          <span>
            <span className="font-semibold">I was 65 or older with 20+ years as a permanent resident when I filed</span>
            <span className="block text-sm text-ink-2">Practice only the 20 designated questions. This does not decide eligibility.</span>
          </span>
        </label>
        <p className="text-sm text-ink-2">
          English exceptions (50/20, 55/15) and medical exceptions (Form N-648) are explained by USCIS: <ExternalLink href="https://www.uscis.gov/citizenship/learn-about-citizenship/the-naturalization-interview-and-test/exceptions-and-accommodations">Exceptions and accommodations</ExternalLink>.
        </p>
      </Card>

      <Card className="space-y-4" aria-labelledby="optional-h">
        <h2 id="optional-h" className="text-lg font-semibold">
          Optional details
        </h2>
        <Field id="state" label="State or territory" hint="Used only to remind you which answers depend on where you live.">
          <Select id="state" value={state} onChange={(e) => setState(e.target.value)} aria-describedby="state-hint">
            <option value="">Prefer not to say</option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="interviewDate" label="Interview date" hint="Only if you have a notice. Countdowns use this date; we never invent one.">
          <Input id="interviewDate" type="date" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} aria-describedby="interviewDate-hint" />
        </Field>
        <Field id="deadline" label="Study deadline" hint="A goal you set for yourself.">
          <Input id="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} aria-describedby="deadline-hint" />
        </Field>
      </Card>

      {error && (
        <Notice tone="bad">
          <p>{error}</p>
        </Notice>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={saving}>
        {profile.onboarded ? "Save changes" : "Start studying"}
      </Button>
      <p className="text-center text-sm text-ink-3">OathSteps is a private study tool, not a government service and not legal advice.</p>
    </form>
  );
}
