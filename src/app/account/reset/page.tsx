"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { ErrorLine } from "@/components/Overlay";
import { Screen } from "@/components/Screen";

function ResetInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const linkError = params.get("error");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setErr("");
    setBusy(true);
    const r = await authClient.resetPassword({ newPassword: password, token });
    setBusy(false);
    if (r.error) return setErr(r.error.message ?? "Could not change the password. Ask for a new link.");
    setPassword("");
    setDone(true);
  };

  const bad = !token || Boolean(linkError);
  return (
    <Screen title="Settings" tab="today" back="/account" showTabs={false} showSettings={false}>
      <div className="o-page o-narrow">
        <div className="o-stack-s">
          <h1 className="o-h1">Choose a new password</h1>
        </div>
        {done ? (
          <section className="o-card o-card-ok" role="status" data-testid="reset-done">
            <div className="o-strong">Password changed.</div>
            <div>You were signed out everywhere. Sign in with your new password.</div>
            <Link href="/account" className="o-btn o-btn-p" style={{ alignSelf: "flex-start" }}>
              Go to sign in
            </Link>
          </section>
        ) : bad ? (
          <section className="o-card o-card-amber" role="alert" data-testid="reset-bad">
            <div className="o-strong">This link doesn’t work.</div>
            <div>It may have expired or already been used. Ask for a new one.</div>
            <Link href="/account" className="o-btn o-btn-s" style={{ alignSelf: "flex-start" }}>
              Back to sign in
            </Link>
          </section>
        ) : (
          <form onSubmit={submit} className="o-card o-stack">
            <div>
              <label className="o-label" htmlFor="new-password">
                New password
              </label>
              <input id="new-password" className="o-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={10} maxLength={128} required aria-describedby="np-help np-err" />
              <div id="np-help" className="o-meta" style={{ marginTop: ".375em" }}>
                At least 10 characters.
              </div>
              {err && <ErrorLine id="np-err">{err}</ErrorLine>}
            </div>
            <button className="o-btn o-btn-p o-btn-lg o-btn-block" type="submit" disabled={busy} data-testid="reset-submit">
              Change password
            </button>
          </form>
        )}
      </div>
    </Screen>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={null}>
      <ResetInner />
    </Suspense>
  );
}
