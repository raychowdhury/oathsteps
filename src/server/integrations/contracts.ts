/**
 * Conditional integrations. Each has an adapter contract and a `disabled` implementation that
 * reports "unavailable" instead of pretending. Real providers plug in behind environment
 * configuration (see docs/INTEGRATIONS.md); none ship in this release because no credentials or
 * authorizations were provided.
 */

export type Unavailable = { status: "unavailable"; reason: string };

// ---- Speech transcription and feedback ----------------------------------------------------------
export interface SpeechEvaluation {
  status: "evaluated";
  transcript: string;
  /** Deterministic match against reviewed answer variants, never a free-form model verdict. */
  verdict: "match" | "no-match" | "inconclusive";
  confidence: number;
  retained: boolean;
}
export interface SpeechProvider {
  readonly name: string;
  evaluate(input: { audio: Uint8Array; mimeType: string; questionId: string; acceptedVariants: string[]; consentVersion: string }): Promise<SpeechEvaluation | Unavailable>;
}

// ---- USCIS case status --------------------------------------------------------------------------
export interface CaseStatus {
  status: "retrieved";
  /** Original message preserved verbatim; mapping to milestones is tentative. */
  message: string;
  retrievedAt: string;
  tentativeMilestone: string | null;
}
export interface StatusProvider {
  readonly name: string;
  /** Transport failure must surface as unavailable, never as "no change". */
  fetchStatus(input: { receiptNumber: string; userAuthorizationToken: string }): Promise<CaseStatus | Unavailable>;
}

// ---- Payments -----------------------------------------------------------------------------------
export interface CheckoutSession {
  status: "created";
  url: string;
  expiresAt: string;
}
export interface Entitlement {
  active: boolean;
  product: "coaching-90d" | null;
  expiresAt: string | null;
  /** Server-verified only; the client never decides entitlement. */
  verifiedAt: string;
}
export interface PaymentsProvider {
  readonly name: string;
  createCheckout(input: { userId: string; product: "coaching-90d"; returnUrl: string }): Promise<CheckoutSession | Unavailable>;
  /** Idempotent: the same event id applied twice yields one entitlement change. */
  handleWebhook(input: { eventId: string; rawBody: string; signature: string }): Promise<{ handled: boolean; duplicate: boolean } | Unavailable>;
  entitlement(userId: string): Promise<Entitlement>;
}

// ---- Push reminders -----------------------------------------------------------------------------
export interface PushProvider {
  readonly name: string;
  subscribe(input: { userId: string; subscription: unknown; consentVersion: string }): Promise<{ status: "subscribed" } | Unavailable>;
  schedule(input: { userId: string; at: string; category: "study" | "appointments" | "checklist"; title: string }): Promise<{ status: "scheduled"; id: string } | Unavailable>;
}

export const integrationFlags = () => ({
  speech: process.env.SPEECH_PROVIDER && process.env.SPEECH_PROVIDER !== "disabled",
  status: process.env.USCIS_STATUS_PROVIDER && process.env.USCIS_STATUS_PROVIDER !== "disabled",
  payments: process.env.PAYMENTS_PROVIDER && process.env.PAYMENTS_PROVIDER !== "disabled",
  push: process.env.PUSH_PROVIDER && process.env.PUSH_PROVIDER !== "disabled",
});
