"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StudyProfile } from "@/domain/types";
import { allPacks, guide } from "@/lib/content";
import { clearOfflineCaches, downloadForOffline } from "@/lib/offline";
import { bankLabel, pathFor } from "@/lib/path";
import { destroyDb } from "@/lib/store/db";
import { exportAll, getMeta, getProfile, listReports, outboxSummary, resetLearningData, saveProfile, setMeta } from "@/lib/store/repo";
import { useData } from "@/lib/store/useData";
import { AccountSection } from "@/components/AccountSection";
import { Button, Card, ExternalLink, Field, Input, LinkButton, Notice, PageTitle, Select, Spinner } from "@/components/ui";

export default function SettingsPage() {
  const router = useRouter();
  const { data, loading } = useData(async () => ({ profile: await getProfile(), offline: await getMeta<{ at: string; cached: number }>("offlineDownload"), reports: await listReports(), outbox: await outboxSummary() }));
  const [status, setStatus] = useState<{ tone: "info" | "good" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"reset" | "delete" | null>(null);
  if (loading || !data) return <Spinner />;
  const { profile, offline, reports, outbox } = data;
  const path = pathFor(profile);
  const update = (patch: Partial<StudyProfile>) => saveProfile(patch);

  const doExport = async () => {
    const payload = await exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `oathsteps-export-${payload.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus({ tone: "good", text: `Exported ${payload.attempts.length} attempts, ${payload.milestones.length} milestones and your settings.` });
  };

  const doDownload = async () => {
    setBusy(true);
    const r = await downloadForOffline();
    if (r.ok) {
      await setMeta("offlineDownload", { at: new Date().toISOString(), cached: r.cached });
      setStatus({ tone: "good", text: `Saved ${r.cached} files for offline use. Question text works offline; audio depends on voices installed on this device.` });
    } else setStatus({ tone: "bad", text: r.error });
    setBusy(false);
  };

  const doReset = async () => {
    setBusy(true);
    await resetLearningData();
    setConfirm(null);
    setBusy(false);
    setStatus({ tone: "good", text: "Learning data cleared. Your preferences and setup were kept." });
  };

  const doDelete = async () => {
    setBusy(true);
    await destroyDb();
    await clearOfflineCaches();
    setBusy(false);
    router.push("/");
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <PageTitle title="Settings" />
      {status && (
        <Notice tone={status.tone}>
          <p>{status.text}</p>
        </Notice>
      )}

      <Card className="space-y-3" aria-labelledby="path-h">
        <h2 id="path-h" className="text-lg font-semibold">
          Test path
        </h2>
        <p>{bankLabel(path)}</p>
        <p className="text-sm text-ink-2">{path.explanation}</p>
        <LinkButton href="/setup" variant="secondary">
          Change filing date, 65/20 or dates
        </LinkButton>
      </Card>

      <Card className="space-y-4" aria-labelledby="pref-h">
        <h2 id="pref-h" className="text-lg font-semibold">
          Reading and audio
        </h2>
        <Field id="textSize" label="Text size">
          <Select id="textSize" value={profile.textSize} onChange={(e) => update({ textSize: e.target.value as StudyProfile["textSize"] })}>
            <option value="normal">Normal</option>
            <option value="large">Large</option>
            <option value="xlarge">Extra large</option>
          </Select>
        </Field>
        <Field id="audioRate" label={`Speech speed: ${profile.audioRate.toFixed(1)}×`} hint="Uses your browser's built-in voices.">
          <input id="audioRate" type="range" min={0.6} max={1.3} step={0.1} value={profile.audioRate} onChange={(e) => update({ audioRate: Number(e.target.value) })} className="w-full" />
        </Field>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="h-5 w-5" checked={profile.reduceMotion} onChange={(e) => update({ reduceMotion: e.target.checked })} />
          Reduce motion
        </label>
        <Field id="newPerDay" label="New questions per day">
          <Input id="newPerDay" type="number" min={0} max={30} value={profile.newPerDay} onChange={(e) => update({ newPerDay: Math.max(0, Math.min(30, Number(e.target.value) || 0)) })} />
        </Field>
      </Card>

      <Card className="space-y-3" aria-labelledby="rem-h">
        <h2 id="rem-h" className="text-lg font-semibold">
          Reminder categories
        </h2>
        <p className="text-sm text-ink-2">Reminders appear inside the app and in your calendar export. OathSteps does not send background notifications.</p>
        {(["study", "appointments", "checklist"] as const).map((k) => (
          <label key={k} className="flex items-center gap-3 capitalize">
            <input type="checkbox" className="h-5 w-5" checked={profile.reminders[k]} onChange={(e) => update({ reminders: { ...profile.reminders, [k]: e.target.checked } })} />
            {k}
          </label>
        ))}
      </Card>

      <Card className="space-y-3" aria-labelledby="off-h">
        <h2 id="off-h" className="text-lg font-semibold">
          Offline use
        </h2>
        <p className="text-sm text-ink-2">{offline ? `Content saved on ${offline.at.slice(0, 10)} (${offline.cached} files). Progress made offline is kept on this device.` : "Not downloaded yet. Save the app and all questions so practice works without a connection."}</p>
        <Button variant="secondary" onClick={doDownload} disabled={busy} data-testid="download-offline">
          {offline ? "Refresh offline content" : "Download for offline use"}
        </Button>
      </Card>

      <AccountSection outbox={outbox} />

      <Card className="space-y-3" aria-labelledby="data-h">
        <h2 id="data-h" className="text-lg font-semibold">
          Your data
        </h2>
        <p className="text-sm text-ink-2">Everything OathSteps stores: your setup, practice attempts, review schedule, mocks, milestones, checklist, bookmarks, confirmed answers and {reports.length} correction report{reports.length === 1 ? "" : "s"}. No identity documents, A-number or application answers are collected.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={doExport} data-testid="export-json">
            Export as JSON
          </Button>
          <Button variant="warn" onClick={() => setConfirm("reset")}>
            Reset learning data
          </Button>
          <Button variant="danger" onClick={() => setConfirm("delete")} data-testid="delete-all">
            Delete everything on this device
          </Button>
        </div>
        {confirm === "reset" && (
          <Notice tone="warn" title="Reset learning data?">
            <p>Attempts, review schedule, mocks, milestones, checklist and bookmarks will be removed. Setup and preferences stay.</p>
            <div className="mt-2 flex gap-2">
              <Button variant="warn" size="sm" onClick={doReset} disabled={busy}>
                Yes, reset
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
            </div>
          </Notice>
        )}
        {confirm === "delete" && (
          <Notice tone="bad" title="Delete everything on this device?">
            <p>All local OathSteps data and offline files are removed. If you have an account, delete it from the Account section first so synced records are removed too.</p>
            <div className="mt-2 flex gap-2">
              <Button variant="danger" size="sm" onClick={doDelete} disabled={busy} data-testid="confirm-delete">
                Yes, delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
            </div>
          </Notice>
        )}
      </Card>

      <Card className="space-y-2 text-sm text-ink-2" aria-labelledby="about-h">
        <h2 id="about-h" className="text-lg font-semibold text-ink">
          Content and review
        </h2>
        <ul className="space-y-1">
          {allPacks().map((p) => (
            <li key={p.packId}>
              {p.title}: pack {p.version}, from <ExternalLink href={p.source.url}>{p.source.title}</ExternalLink>, retrieved {p.source.retrievedAt.slice(0, 10)}. {p.review.humanReviewed ? "Human reviewed." : "Machine-checked, not yet human-reviewed."}
            </li>
          ))}
          <li>Guide {guide.version}: {guide.review.humanReviewed ? "human reviewed" : "machine-checked, not yet human-reviewed"}.</li>
        </ul>
        <p>OathSteps is a private educational tool. It is not affiliated with USCIS, does not provide legal advice and does not predict interview outcomes.</p>
      </Card>
    </div>
  );
}
