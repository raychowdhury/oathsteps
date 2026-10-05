"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient, useSession } from "@/lib/auth-client";
import { clearOfflineCaches } from "@/lib/offline";
import { destroyDb } from "@/lib/store/db";
import { getMeta, listAttempts, outboxSummary } from "@/lib/store/repo";
import { useData } from "@/lib/store/useData";
import { pullAndMerge, pushOutbox, recordConsent, type SyncStatus } from "@/lib/sync";
import { Icon } from "@/components/icons";
import { ErrorLine } from "@/components/Overlay";
import { Screen } from "@/components/Screen";

export default function AccountPage() {
  const { data: session, isPending, refetch } = useSession();
  const router = useRouter();
  const { data } = useData(async () => ({ outbox: await outboxSummary(), sync: await getMeta<SyncStatus>("sync"), consent: await getMeta<{ grantedAt: string }>("consent:migrate-guest-progress"), attempts: (await listAttempts()).length }));
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "forgot">("sign-up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "forgot") {
      const r = await authClient.requestPasswordReset({ email, redirectTo: "/account/reset" });
      setBusy(false);
      // The server answers the same way whether or not the address has an account.
      if (r.error) return setMsg({ ok: false, text: r.error.message ?? "Could not send the reset link. Try again." });
      return setMsg({ ok: true, text: "If an account exists for that email, a reset link is on its way. It works for one hour." });
    }
    const r = mode === "sign-up" ? await authClient.signUp.email({ email, password, name: name || email.split("@")[0] }) : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (r.error) return setMsg({ ok: false, text: r.error.message ?? "Could not sign in." });
    setPassword("");
    refetch();
    setMsg({ ok: true, text: mode === "sign-up" ? "Account created. A confirmation email was sent." : "Signed in." });
  };
  const migrate = async () => {
    setBusy(true);
    const ok = await recordConsent("migrate-guest-progress");
    if (!ok) {
      setBusy(false);
      return setMsg({ ok: false, text: "Could not record consent. Try again." });
    }
    const push = await pushOutbox();
    const pull = await pullAndMerge();
    setBusy(false);
    setMsg(push.error || pull.error ? { ok: false, text: push.error ?? pull.error ?? "Sync failed" } : { ok: true, text: `Synced ${push.sent} change${push.sent === 1 ? "" : "s"} and merged ${pull.merged} record${pull.merged === 1 ? "" : "s"} from your account.` });
  };
  const syncNow = async () => {
    setBusy(true);
    const push = await pushOutbox();
    const pull = await pullAndMerge();
    setBusy(false);
    setMsg(push.error || pull.error ? { ok: false, text: push.error ?? pull.error ?? "Sync failed" } : { ok: true, text: `Up to date. Sent ${push.sent}, merged ${pull.merged}.` });
  };
  const signOut = async () => {
    setBusy(true);
    await pushOutbox().catch(() => {});
    await authClient.signOut();
    await destroyDb();
    await clearOfflineCaches();
    setBusy(false);
    router.push("/");
    router.refresh();
  };
  const deleteAccount = async () => {
    setBusy(true);
    const res = await fetch("/api/account", { method: "DELETE", credentials: "same-origin" });
    if (!res.ok) {
      setBusy(false);
      return setMsg({ ok: false, text: `Deletion failed (${res.status}).` });
    }
    await authClient.signOut().catch(() => {});
    await destroyDb();
    await clearOfflineCaches();
    setBusy(false);
    router.push("/");
    router.refresh();
  };

  if (isPending || !data) return null;
  return (
    <Screen title="Settings" tab="today" back="/settings" showSettings={false}>
      <div className="o-page o-narrow">
        <div className="o-stack-s">
          <h1 className="o-h1">Account</h1>
          <p className="o-help">Optional. Accounts exist only to keep your progress across devices. Guest study is complete without one.</p>
        </div>
        {msg && (
          <div className={`o-card ${msg.ok ? "o-card-ok" : "o-card-amber"}`} role={msg.ok ? "status" : "alert"} style={{ gap: ".25em" }} data-testid="account-msg">
            <div>{msg.text}</div>
          </div>
        )}
        {!session ? (
          <section className="o-card">
            {mode === "forgot" ? (
              <div className="o-stack-s">
                <h2 className="o-h2">Reset your password</h2>
                <p className="o-help">Enter your account email. We will send a link to choose a new password.</p>
              </div>
            ) : (
              <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
                <legend className="o-sr">Sign in or create account</legend>
                <div className="o-seg">
                  <label className={mode === "sign-up" ? "o-on" : ""}>
                    <input type="radio" name="acct-mode" checked={mode === "sign-up"} onChange={() => setMode("sign-up")} />
                    <span>Create account</span>
                  </label>
                  <label className={mode === "sign-in" ? "o-on" : ""}>
                    <input type="radio" name="acct-mode" checked={mode === "sign-in"} onChange={() => setMode("sign-in")} />
                    <span>Sign in</span>
                  </label>
                </div>
              </fieldset>
            )}
            <form onSubmit={submit} className="o-stack">
              {mode === "sign-up" && (
                <div>
                  <label className="o-label" htmlFor="name">
                    Name (what should we call you?)
                  </label>
                  <input id="name" className="o-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} />
                </div>
              )}
              <div>
                <label className="o-label" htmlFor="email">
                  Email
                </label>
                <input id="email" className="o-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              </div>
              {mode !== "forgot" && (
                <div>
                  <label className="o-label" htmlFor="password">
                    Password
                  </label>
                  <input id="password" className="o-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "sign-up" ? "new-password" : "current-password"} minLength={10} required />
                  <div className="o-meta" style={{ marginTop: ".375em" }}>
                    At least 10 characters.
                  </div>
                </div>
              )}
              <button className="o-btn o-btn-p o-btn-lg o-btn-block" type="submit" disabled={busy} data-testid={mode === "forgot" ? "forgot-submit" : "account-submit"}>
                {mode === "sign-up" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
              </button>
              {mode === "sign-in" && (
                <button className="o-btn o-btn-g" type="button" onClick={() => { setMode("forgot"); setMsg(null); }} style={{ alignSelf: "flex-start" }} data-testid="forgot-link">
                  Forgot your password?
                </button>
              )}
              {mode === "forgot" && (
                <button className="o-btn o-btn-g" type="button" onClick={() => { setMode("sign-in"); setMsg(null); }} style={{ alignSelf: "flex-start" }}>
                  Back to sign in
                </button>
              )}
              {mode === "sign-up" && (
                <p className="o-meta">
                  By creating an account you accept the <Link href="/terms">Terms</Link> and the <Link href="/privacy">Privacy notice</Link>.
                </p>
              )}
            </form>
            <p className="o-meta">
              We store your email, name, a password hash, your sign-in sessions and the study records you choose to sync. Details are in the <Link href="/privacy">Privacy notice</Link>.
            </p>
          </section>
        ) : (
          <>
            <section className="o-card">
              <p>
                Signed in as <strong>{session.user.email}</strong>
                {session.user.emailVerified ? "" : " (email not yet confirmed)"}.
              </p>
              {!data.consent ? (
                <div className="o-card o-card-guide">
                  <div className="o-strong">Move your guest progress into this account?</div>
                  <div>
                    {data.attempts} practice record{data.attempts === 1 ? "" : "s"} and your settings are stored on this device. With your consent they are uploaded to your account and kept in sync. You can delete them at any time.
                  </div>
                  <button className="o-btn o-btn-p" type="button" onClick={migrate} disabled={busy} style={{ alignSelf: "flex-start" }} data-testid="migrate">
                    Yes, migrate and sync
                  </button>
                </div>
              ) : (
                <>
                  <p className="o-meta">
                    Sync consent given {data.consent.grantedAt.slice(0, 10)}. {data.outbox.pending} pending, {data.outbox.failed} failed.
                    {data.sync?.lastPushAt && ` Last sent ${data.sync.lastPushAt.slice(0, 16).replace("T", " ")}.`}
                  </p>
                  {data.sync?.lastError && <ErrorLine>Last error: {data.sync.lastError}</ErrorLine>}
                  <button className="o-btn o-btn-s" type="button" onClick={syncNow} disabled={busy} style={{ alignSelf: "flex-start" }} data-testid="sync-now">
                    Sync now
                  </button>
                </>
              )}
            </section>
            <section className="o-card">
              <h2 className="o-h2">Sign out</h2>
              <p className="o-help">Signing out clears this device’s copy of your data so the next person cannot see it. Your account keeps everything that was synced.</p>
              <button className="o-btn o-btn-n" type="button" onClick={signOut} disabled={busy} style={{ alignSelf: "flex-start" }} data-testid="sign-out">
                Sign out
              </button>
            </section>
            <section className="o-card">
              <h2 className="o-h2">Delete account</h2>
              <p className="o-help">Removes your account, sessions and every synced record, then clears this device. Not reversible.</p>
              {!confirmDelete ? (
                <button className="o-btn o-btn-d" type="button" onClick={() => setConfirmDelete(true)} style={{ alignSelf: "flex-start" }} data-testid="delete-account">
                  <Icon name="trash" />
                  Delete my account
                </button>
              ) : (
                <div className="o-actions-2">
                  <button className="o-btn o-btn-n" type="button" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </button>
                  <button className="o-btn o-btn-d" type="button" onClick={deleteAccount} disabled={busy} data-testid="confirm-delete-account">
                    Yes, delete everything
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Screen>
  );
}
