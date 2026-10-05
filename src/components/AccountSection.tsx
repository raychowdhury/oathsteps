"use client";
import { useSession } from "@/lib/auth-client";
import { Card, LinkButton, Pill } from "./ui";

export function AccountSection({ outbox }: { outbox: { pending: number; failed: number; lastError?: string } }) {
  const { data: session, isPending } = useSession();
  return (
    <Card className="space-y-2" aria-labelledby="acct-h">
      <h2 id="acct-h" className="text-lg font-semibold">
        Account and sync
      </h2>
      {isPending ? (
        <p className="text-sm text-ink-3">Checking…</p>
      ) : session ? (
        <p className="text-sm text-ink-2">
          Signed in as <strong>{session.user.email}</strong>. {outbox.pending} change{outbox.pending === 1 ? "" : "s"} waiting to sync{outbox.failed ? `, ${outbox.failed} failed` : ""}.
          {outbox.failed > 0 && <Pill tone="bad" className="ml-2">needs retry</Pill>}
        </p>
      ) : (
        <p className="text-sm text-ink-2">Optional. An account keeps your progress across devices. Guest study works fully without one.</p>
      )}
      <LinkButton href="/account" variant="secondary">
        {session ? "Manage account and sync" : "Create account or sign in"}
      </LinkButton>
    </Card>
  );
}
