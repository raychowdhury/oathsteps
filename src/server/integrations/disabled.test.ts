import { afterEach, describe, expect, it } from "vitest";
import { disabledPayments, disabledPush, disabledSpeech, disabledStatus, providers } from "./disabled";

describe("disabled integrations never fabricate success", () => {
  afterEach(() => {
    delete process.env.SPEECH_PROVIDER;
    delete process.env.PAYMENTS_PROVIDER;
  });

  it("speech reports unavailable, not a verdict", async () => {
    const r = await disabledSpeech.evaluate({ audio: new Uint8Array(), mimeType: "audio/webm", questionId: "2025-001", acceptedVariants: ["republic"], consentVersion: "1" });
    expect(r.status).toBe("unavailable");
  });

  it("status reports unavailable, never 'no change'", async () => {
    const r = await disabledStatus.fetchStatus({ receiptNumber: "x", userAuthorizationToken: "y" });
    expect(r).toMatchObject({ status: "unavailable" });
  });

  it("payments grant no entitlement and refuse checkout", async () => {
    expect(await disabledPayments.entitlement("u1")).toMatchObject({ active: false, product: null });
    expect((await disabledPayments.createCheckout({ userId: "u1", product: "coaching-90d", returnUrl: "/" })).status).toBe("unavailable");
    const wh = await disabledPayments.handleWebhook({ eventId: "e", rawBody: "", signature: "" });
    expect("status" in wh && wh.status).toBe("unavailable");
  });

  it("push cannot subscribe or schedule", async () => {
    expect((await disabledPush.subscribe({ userId: "u1", subscription: {}, consentVersion: "1" })).status).toBe("unavailable");
  });

  it("an unknown provider name fails loudly instead of silently running disabled", () => {
    process.env.SPEECH_PROVIDER = "acme";
    expect(() => providers()).toThrow(/not implemented/);
    delete process.env.SPEECH_PROVIDER;
    expect(providers().speech.name).toBe("disabled");
  });
});
