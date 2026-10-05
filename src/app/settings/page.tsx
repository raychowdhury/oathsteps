"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { todayDateOnly } from "@/domain/dates";
import { statusLabel } from "@/domain/journey";
import type { StudyProfile } from "@/domain/types";
import { fmtDate } from "@/domain/validation";
import { useSession } from "@/lib/auth-client";
import { allPacks } from "@/lib/content";
import { loadDemoLearner } from "@/lib/demo";
import { guide } from "@/lib/guide";
import { clearOfflineCaches, downloadForOffline } from "@/lib/offline";
import { destroyDb } from "@/lib/store/db";
import { exportAll, getMeta, listChecklist, listReports, outboxSummary, resetPractice, saveProfile, setMeta } from "@/lib/store/repo";
import { useData } from "@/lib/store/useData";
import { loadSnapshot } from "@/lib/today";
import { US_STATES } from "@/lib/us-states";
import { FilingSheet } from "@/components/FilingSheet";
import { Icon } from "@/components/icons";
import { MilestoneSheet } from "@/components/MilestoneSheet";
import { ErrorLine, Sheet, useToast } from "@/components/Overlay";
import { Screen } from "@/components/Screen";

const HOURS = Array.from({ length: 24 }, (_, h) => ({ v: h, l: `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? "AM" : "PM"}` }));

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const { data: s } = useData(loadSnapshot);
  const { data: extra } = useData(async () => ({ reports: await listReports(), outbox: await outboxSummary(), checklist: await listChecklist(), demo: Boolean(await getMeta<boolean>("illustrative")) }));
  const [sheet, setSheet] = useState<"filing" | "interview" | "export" | "reset" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [delText, setDelText] = useState("");
  const [delErr, setDelErr] = useState(false);
  // Controls reflect a change immediately; the store write follows.
  const [draft, setDraft] = useState<StudyProfile | null>(null);
  if (!s || !extra) return null;
  const p = draft ?? s.profile;
  const rem = p.reminders;
  const update = (patch: Partial<StudyProfile>) => {
    setDraft({ ...p, ...patch });
    void saveProfile(patch);
  };
  const setRem = (patch: Partial<StudyProfile["reminders"]>) => update({ reminders: { ...rem, ...patch } });
  const remCount = (rem.daily ? 1 : 0) + (rem.review ? 1 : 0) + extra.checklist.filter((c) => c.remind && !c.completedAt).length;
  const iv = s.journey.interview;

  const download = async () => {
    setBusy(true);
    const r = await downloadForOffline();
    setBusy(false);
    if (r.ok) {
      await setMeta("offlineDownload", { at: new Date().toISOString(), cached: r.cached });
      toast(`Saved ${r.cached} files for offline use. Listening uses the voices on this device.`);
    } else toast(r.error);
  };
  const removeDownload = async () => {
    await clearOfflineCaches();
    await setMeta("offlineDownload", null);
    toast("Download removed. Questions still work online; practice offline needs the download.");
  };
  const doExport = async () => {
    const payload = await exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `oathsteps-export-${payload.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setSheet(null);
    toast(`Exported ${payload.attempts.length} practice records, your journey and settings.`);
  };
  const doReset = async () => {
    await resetPractice();
    setSheet(null);
    toast("Practice progress reset.");
  };
  const doDelete = async () => {
    if (delText !== "DELETE") return setDelErr(true);
    setBusy(true);
    await destroyDb();
    await clearOfflineCaches();
    setBusy(false);
    setSheet(null);
    router.push("/");
    router.refresh();
  };
  const loadDemo = async () => {
    setBusy(true);
    await loadDemoLearner(todayDateOnly());
    setBusy(false);
    toast("Loaded a returning learner with illustrative, fictional history.");
  };
  const clearDemo = async () => {
    await resetPractice();
    await saveProfile({ onboarded: false, filingDate: null, filingDateUnknown: false, specialConsideration: false, state: null });
    toast("Demo data cleared.");
    router.push("/");
  };

  return (
    <Screen title="Settings" tab="today" back="/" showSettings={false} demo={extra.demo}>
      <div className="o-page">
        <h1 className="o-h1">Settings</h1>
        <div className="o-cols">
          <div className="o-stack">
            <section className="o-card">
              <h2 className="o-h2">Reading and listening</h2>
              <div>
                <label className="o-label" htmlFor="set-lang">
                  Help language
                </label>
                <select id="set-lang" className="o-input" value="en" disabled>
                  <option value="en">English</option>
                </select>
                <div className="o-meta" style={{ marginTop: ".375em" }}>
                  Other languages will be offered after a reviewed translation exists.
                </div>
              </div>
              <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
                <legend className="o-label">Appearance</legend>
                <div className="o-seg">
                  {(["system", "light", "dark"] as const).map((t) => (
                    <label key={t} className={p.theme === t ? "o-on" : ""}>
                      <input type="radio" name="theme" checked={p.theme === t} onChange={() => update({ theme: t })} />
                      <span>{t === "system" ? "System" : t === "light" ? "Light" : "Dark"}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
                <legend className="o-label">Text size</legend>
                <div className="o-seg">
                  {([["normal", "Default"], ["large", "Large"], ["xlarge", "Larger"]] as const).map(([v, l]) => (
                    <label key={v} className={p.textSize === v ? "o-on" : ""}>
                      <input type="radio" name="ts" checked={p.textSize === v} onChange={() => update({ textSize: v })} />
                      <span>{l}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
                <legend className="o-label">Audio speed</legend>
                <div className="o-seg">
                  {([[0.8, "Slower"], [1, "Normal"], [1.2, "Faster"]] as const).map(([v, l]) => (
                    <label key={v} className={p.audioRate === v ? "o-on" : ""}>
                      <input type="radio" name="sp" checked={p.audioRate === v} onChange={() => update({ audioRate: v })} />
                      <span>{l}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="o-switch">
                <input type="checkbox" role="switch" checked={p.reduceMotion} onChange={() => update({ reduceMotion: !p.reduceMotion })} />
                <span className="o-switch-ui" />
                <span>Reduce motion</span>
              </label>
            </section>
            <section className="o-card">
              <h2 className="o-h2">Reminders</h2>
              <label className="o-switch">
                <input type="checkbox" role="switch" checked={rem.study} onChange={() => setRem({ study: !rem.study })} />
                <span className="o-switch-ui" />
                <span className="o-grow">
                  <span className="o-strong">Study reminders</span>
                </span>
              </label>
              {rem.study && (
                <div className="o-stack-xs" style={{ paddingLeft: ".25em" }}>
                  <label className="o-check">
                    <input type="checkbox" checked={rem.daily} onChange={() => setRem({ daily: !rem.daily })} />
                    <span>Daily practice</span>
                  </label>
                  <label className="o-check">
                    <input type="checkbox" checked={rem.review} onChange={() => setRem({ review: !rem.review })} />
                    <span>When reviews are due</span>
                  </label>
                  <div className="o-grid2">
                    <div>
                      <label className="o-label" htmlFor="q-from">
                        Quiet from
                      </label>
                      <select id="q-from" className="o-input" value={rem.quietFrom} onChange={(e) => setRem({ quietFrom: Number(e.target.value) })}>
                        {HOURS.map((h) => (
                          <option key={h.v} value={h.v}>
                            {h.l}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="o-label" htmlFor="q-to">
                        Quiet until
                      </label>
                      <select id="q-to" className="o-input" value={rem.quietTo} onChange={(e) => setRem({ quietTo: Number(e.target.value) })}>
                        {HOURS.map((h) => (
                          <option key={h.v} value={h.v}>
                            {h.l}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {rem.quietFrom === rem.quietTo && <ErrorLine>Start and end can’t be the same time.</ErrorLine>}
                  <div className="o-meta">{remCount} study reminders on</div>
                </div>
              )}
              <label className="o-switch" style={{ paddingTop: ".5em", borderTop: "1px solid var(--line)" }}>
                <input type="checkbox" role="switch" checked={rem.appointments} onChange={() => setRem({ appointments: !rem.appointments })} />
                <span className="o-switch-ui" />
                <span className="o-grow">
                  <span className="o-strong">Appointment reminders</span>
                  <br />
                  <span className="o-meta">7 days and 1 day before</span>
                </span>
              </label>
              <p className="o-meta">Reminders show inside the app and in your calendar export. No push notifications are sent.</p>
            </section>
          </div>
          <div className="o-stack">
            <section className="o-card">
              <h2 className="o-h2">Your study path</h2>
              <div className="o-li" style={{ paddingTop: 0 }}>
                <div className="o-grow">
                  <div className="o-meta">Civics test</div>
                  <div className="o-strong" data-testid="settings-path">
                    {s.route.short}
                  </div>
                  <div className="o-meta">{p.filingDate ? `Filed ${fmtDate(p.filingDate)}` : "No filing date"}</div>
                </div>
                <button className="o-btn o-btn-g" type="button" onClick={() => setSheet("filing")}>
                  Change
                </button>
              </div>
              <div className="o-li">
                <div className="o-grow">
                  <div className="o-meta">Interview date (optional)</div>
                  <div className="o-strong">{iv.date ? `${fmtDate(iv.date)} · ${statusLabel("interview", iv.status)}` : "Not added"}</div>
                </div>
                <button className="o-btn o-btn-g" type="button" onClick={() => setSheet("interview")}>
                  Change
                </button>
              </div>
              <div className="o-li">
                <div className="o-grow">
                  <div className="o-meta">State or territory (optional)</div>
                  <select className="o-input" value={p.state ?? ""} onChange={(e) => update({ state: e.target.value || null })} aria-label="State or territory">
                    <option value="">Choose one (optional)</option>
                    {US_STATES.map((st) => (
                      <option key={st.code} value={st.code}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>
            <section className="o-card">
              <h2 className="o-h2">Offline</h2>
              <div className="o-row">
                <span className={`o-tag ${s.downloaded ? "o-tag-ok" : "o-tag-n"}`}>{s.downloaded ? "Downloaded" : "Not downloaded"}</span>
                <span className="o-meta">App and all questions</span>
              </div>
              {!s.downloaded ? (
                <button className="o-btn o-btn-s" type="button" onClick={download} disabled={busy} style={{ alignSelf: "flex-start" }} data-testid="download-offline">
                  <Icon name="download" />
                  Download for offline use
                </button>
              ) : (
                <button className="o-btn o-btn-g" type="button" onClick={removeDownload} style={{ alignSelf: "flex-start" }}>
                  Remove download
                </button>
              )}
            </section>
            <section className="o-card">
              <h2 className="o-h2">Account and sync</h2>
              <p className="o-help">{session ? `Signed in as ${session.user.email}. ${extra.outbox.pending} change${extra.outbox.pending === 1 ? "" : "s"} waiting to sync${extra.outbox.failed ? `, ${extra.outbox.failed} failed` : ""}.` : "Optional. Keeps your progress across devices. Guest study is complete without one."}</p>
              <Link href="/account" className="o-btn o-btn-n" style={{ justifyContent: "flex-start" }}>
                <Icon name="person" />
                {session ? "Manage account and sync" : "Create account or sign in"}
              </Link>
            </section>
            <section className="o-card">
              <h2 className="o-h2">Your data</h2>
              <p className="o-help">Stays on this device unless you sign in and choose to sync.</p>
              <button className="o-btn o-btn-n" type="button" onClick={() => setSheet("export")} style={{ justifyContent: "flex-start" }} data-testid="export-json">
                <Icon name="upload" />
                Export my study data
              </button>
              <button className="o-btn o-btn-n" type="button" onClick={() => setSheet("reset")} style={{ justifyContent: "flex-start" }} data-testid="reset-practice">
                <Icon name="again" />
                Reset practice progress
              </button>
              <button className="o-btn o-btn-d" type="button" onClick={() => setSheet("delete")} style={{ justifyContent: "flex-start" }} data-testid="delete-all">
                <Icon name="trash" />
                Delete all data
              </button>
              {extra.reports.length > 0 && <p className="o-meta">{extra.reports.length} saved answer report{extra.reports.length === 1 ? "" : "s"} are included in the export.</p>}
            </section>
            <section className="o-proto">
              <div className="o-meta">Demo data</div>
              <p className="o-help">Load a fictional returning learner to explore the app. Replaces practice progress; labeled Demo until cleared.</p>
              <div className="o-actions-2">
                <button className="o-btn o-btn-n" type="button" onClick={clearDemo} disabled={busy || !extra.demo}>
                  Clear demo
                </button>
                <button className="o-btn o-btn-n" type="button" onClick={loadDemo} disabled={busy} data-testid="load-demo">
                  Returning learner
                </button>
              </div>
              <p className="o-meta">Fictional data.</p>
            </section>
            <section className="o-card" style={{ gap: ".375em" }}>
              <h2 className="o-h2">Content and review</h2>
              {allPacks().map((pk) => (
                <p key={pk.packId} className="o-meta">
                  {pk.title}: pack {pk.version}, retrieved {pk.source.retrievedAt.slice(0, 10)}. {pk.review.humanReviewed ? "Human reviewed." : "Machine-checked, not yet expert-reviewed."}
                </p>
              ))}
              <p className="o-meta">Guide {guide.version}: {guide.review.humanReviewed ? "human reviewed" : "draft, not expert-reviewed"}.</p>
              <p className="o-meta">OathSteps is a private study tool. Not affiliated with USCIS. Not legal advice.</p>
            </section>
          </div>
        </div>
      </div>

      {sheet === "filing" && <FilingSheet profile={p} onClose={() => setSheet(null)} />}
      {sheet === "interview" && <MilestoneSheet slotKey="interview" journey={s.journey} filing={p.filingDate} today={s.today} initialStatus={iv.status === "none" ? "scheduled" : iv.status} onClose={() => setSheet(null)} />}
      {sheet === "export" && (
        <Sheet title="Export my study data" onClose={() => setSheet(null)}>
          <p>Settings, practice, journey dates and checklist. No audio.</p>
          <p className="o-meta">A JSON file is saved to your downloads.</p>
          <button className="o-btn o-btn-p o-btn-block" type="button" onClick={doExport} data-testid="confirm-export">
            Export file
          </button>
        </Sheet>
      )}
      {sheet === "reset" && (
        <Sheet title="Reset practice progress?" onClose={() => setSheet(null)}>
          <p>Clears practice and mocks. Journey and settings stay.</p>
          <div className="o-actions-2">
            <button className="o-btn o-btn-n" type="button" onClick={() => setSheet(null)}>
              Cancel
            </button>
            <button className="o-btn o-btn-d" type="button" onClick={doReset} data-testid="confirm-reset">
              Reset progress
            </button>
          </div>
        </Sheet>
      )}
      {sheet === "delete" && (
        <Sheet title="Delete all data?" onClose={() => setSheet(null)}>
          <p>Deletes everything on this device. Can’t be undone.{session ? " Your account keeps what was synced; delete it from the Account page too." : ""}</p>
          <div>
            <label className="o-label" htmlFor="del-in">
              Type DELETE to confirm
            </label>
            <input
              id="del-in"
              className="o-input"
              value={delText}
              onChange={(e) => {
                setDelText(e.target.value);
                setDelErr(false);
              }}
              autoComplete="off"
              aria-invalid={delErr ? "true" : "false"}
              aria-describedby="del-err"
            />
            {delErr && <ErrorLine id="del-err">Type DELETE in capital letters to continue.</ErrorLine>}
          </div>
          <div className="o-actions-2">
            <button className="o-btn o-btn-n" type="button" onClick={() => setSheet(null)}>
              Cancel
            </button>
            <button className="o-btn o-btn-d" type="button" onClick={doDelete} disabled={busy} data-testid="confirm-delete">
              Delete everything
            </button>
          </div>
        </Sheet>
      )}
    </Screen>
  );
}
