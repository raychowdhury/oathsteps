"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient, useSession } from "@/lib/auth-client";
import { clearOfflineCaches } from "@/lib/offline";
import { destroyDb } from "@/lib/store/db";
import { getMeta, listAttempts, outboxSummary } from "@/lib/store/repo";
import { useData } from "@/lib/store/useData";
import { pullAndMerge, pushOutbox, recordConsent, type SyncStatus } from "@/lib/sync";
import { Button, Card, Field, Input, Notice, PageTitle, Spinner } from "@/components/ui";

export default function AccountPage() {
  const { data: session, isPending, refetch } = useSession();
  const router = useRouter();
  const { data } = useData(async () => ({ outbox: await outboxSummary(), sync: await getMeta<SyncStatus>("sync"), consent: await getMeta<{ grantedAt: string }>("consent:migrate-guest-progress"), attempts: (await listAttempts()).length }));
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ tone: "good" | "bad" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = mode === "sign-up" ? await authClient.signUp.email({ email, password, name: name || email.split("@")[0] }) : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (r.error) return setMsg({ tone: "bad", text: r.error.message ?? "Could not sign in." });
    setPassword("");
    refetch();
    setMsg({ tone: "good", text: mode === "sign-up" ? "Account created. A confirmation email was sent (in development it is written to the mail sink folder)." : "Signed in." });
  };

  const migrate = async () => {
    setBusy(true);
    const ok = await recordConsent("migrate-guest-progress");
    if (!ok) {
      setBusy(false);
      return setMsg({ tone: "bad", text: "Could not record consent. Try again." });
    }
    const push = await pushOutbox();
    const pull = await pullAndMerge();
    setBusy(false);
    setMsg(push.error || pull.error ? { tone: "bad", text: push.error ?? pull.error ?? "Sync failed" } : { tone: "good", text: `Synced ${push.sent} change${push.sent === 1 ? "" : "s"} and merged ${pull.merged} record${pull.merged === 1 ? "" : "s"} from your account.` });
  };

  const syncNow = async () => {
    setBusy(true);
    const push = await pushOutbox();
    const pull = await pullAndMerge();
    setBusy(false);
    setMsg(push.error || pull.error ? { tone: "bad", text: push.error ?? pull.error ?? "Sync failed" } : { tone: "good", text: `Up to date. Sent ${push.sent}, merged ${pull.merged}.` });
  };

  const signOut = async () => {
    setBusy(true);
    await pushOutbox().catch(() => {});
    await authClient.signOut();
    // Private cache must not be readable by the next person who signs in on this device.
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
      return setMsg({ tone: "bad", text: `Deletion failed (${res.status}).` });
    }
    await authClient.signOut().catch(() => {});
    await destroyDb();
    await clearOfflineCaches();
    setBusy(false);
    router.push("/");
    router.refresh();
  };

  if (isPending || !data) return <Spinner />;

  return (
    <div className="space-y-4">
      <PageTitle title="Account" lead="Optional. Accounts exist only to keep your progress across devices. Guest study is complete without one." />
      {msg && (
        <Notice tone={msg.tone}>
          <p>{msg.text}</p>
        </Notice>
      )}
      {!session ? (
        <Card className="space-y-4">
          <div className="flex gap-2" role="tablist" aria-label="Sign in or create account">
            <Button type="button" variant={mode === "sign-up" ? "primary" : "secondary"} size="sm" role="tab" aria-selected={mode === "sign-up"} onClick={() => setMode("sign-up")}>
              Create account
            </Button>
            <Button type="button" variant={mode === "sign-in" ? "primary" : "secondary"} size="sm" role="tab" aria-selected={mode === "sign-in"} onClick={() => setMode("sign-in")}>
              Sign in
            </Button>
          </div>
          <form onSubmit={submit} className="space-y-3">
            {mode === "sign-up" && (
              <Field id="name" label="Name (what should we call you?)">
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} />
              </Field>
            )}
            <Field id="email" label="Email">
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </Field>
            <Field id="password" label="Password" hint="At least 10 characters.">
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "sign-up" ? "new-password" : "current-password"} minLength={10} required />
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {mode === "sign-up" ? "Create account" : "Sign in"}
            </Button>
          </form>
          <p className="text-sm text-ink-3">We store your email, a password hash and your synced study records. Nothing else.</p>
        </Card>
      ) : (
        <>
          <Card className="space-y-3">
            <p>
              Signed in as <strong>{session.user.email}</strong>
              {session.user.emailVerified ? "" : " (email not yet confirmed)"}.
            </p>
            {!data.consent ? (
              <Notice tone="info" title="Move your guest progress into this account?">
                <p>
                  {data.attempts} attempt{data.attempts === 1 ? "" : "s"} and your settings are stored on this device. With your consent they are uploaded to your account and kept in sync. You can delete them at any time.
                </p>
                <div className="mt-2">
                  <Button onClick={migrate} disabled={busy} data-testid="migrate">
                    Yes, migrate and sync
                  </Button>
                </div>
              </Notice>
            ) : (
              <>
                <p className="text-sm text-ink-2">
                  Sync consent given {data.consent.grantedAt.slice(0, 10)}. {data.outbox.pending} pending, {data.outbox.failed} failed.
                  {data.sync?.lastPushAt && ` Last sent ${data.sync.lastPushAt.slice(0, 16).replace("T", " ")}.`}
                  {data.sync?.lastError && <span className="text-bad"> Last error: {data.sync.lastError}</span>}
                </p>
                <Button variant="secondary" onClick={syncNow} disabled={busy} data-testid="sync-now">
                  Sync now
                </Button>
              </>
            )}
          </Card>
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold">Sign out</h2>
            <p className="text-sm text-ink-2">Signing out clears this device’s copy of your data so the next person cannot see it. Your account keeps everything that was synced.</p>
            <Button variant="secondary" onClick={signOut} disabled={busy} data-testid="sign-out">
              Sign out
            </Button>
          </Card>
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold">Delete account</h2>
            <p className="text-sm text-ink-2">Removes your account, sessions and every synced record, then clears this device. Not reversible.</p>
            {!confirmDelete ? (
              <Button variant="danger" onClick={() => setConfirmDelete(true)} data-testid="delete-account">
                Delete my account
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="danger" onClick={deleteAccount} disabled={busy} data-testid="confirm-delete-account">
                  Yes, delete everything
                </Button>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
