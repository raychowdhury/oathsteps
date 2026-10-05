import type { PaymentsProvider, PushProvider, SpeechProvider, StatusProvider } from "./contracts";

const unavailable = (what: string) => ({ status: "unavailable" as const, reason: `${what} is not configured. Self-assessed practice and manual tracking remain available.` });

export const disabledSpeech: SpeechProvider = {
  name: "disabled",
  evaluate: async () => unavailable("Speech feedback"),
};

export const disabledStatus: StatusProvider = {
  name: "disabled",
  fetchStatus: async () => unavailable("USCIS case status synchronization"),
};

export const disabledPayments: PaymentsProvider = {
  name: "disabled",
  createCheckout: async () => unavailable("Checkout"),
  handleWebhook: async () => unavailable("Payment webhooks"),
  entitlement: async () => ({ active: false, product: null, expiresAt: null, verifiedAt: new Date().toISOString() }),
};

export const disabledPush: PushProvider = {
  name: "disabled",
  subscribe: async () => unavailable("Push reminders"),
  schedule: async () => unavailable("Push reminders"),
};

/** Resolve providers from configuration. Only `disabled` exists in this release. */
export function providers() {
  const pick = (env: string | undefined, what: string) => {
    if (env && env !== "disabled") throw new Error(`${what} provider "${env}" is not implemented in this release; see docs/INTEGRATIONS.md`);
  };
  pick(process.env.SPEECH_PROVIDER, "Speech");
  pick(process.env.USCIS_STATUS_PROVIDER, "USCIS status");
  pick(process.env.PAYMENTS_PROVIDER, "Payments");
  pick(process.env.PUSH_PROVIDER, "Push");
  return { speech: disabledSpeech, status: disabledStatus, payments: disabledPayments, push: disabledPush };
}
