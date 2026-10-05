import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { deliverMail, mailProvider } from "./mail";

const msg = { to: "learner@example.com", subject: "Hello", text: "Body" };

describe("mail provider selection", () => {
  it("prefers an explicit provider, falls back to the sink only when a sink dir exists, else none", () => {
    expect(mailProvider({ MAIL_PROVIDER: "resend", MAIL_SINK_DIR: "x" })).toBe("resend");
    expect(mailProvider({ MAIL_PROVIDER: " Resend " })).toBe("resend");
    expect(mailProvider({ MAIL_SINK_DIR: "x" })).toBe("sink");
    expect(mailProvider({ MAIL_PROVIDER: "sink" })).toBe("sink");
    expect(mailProvider({})).toBe("none");
    expect(mailProvider({ MAIL_PROVIDER: "carrier-pigeon" })).toBe("none");
  });
});

describe("deliverMail", () => {
  it("fails loudly with no transport", async () => {
    await expect(deliverMail(msg, { env: {} })).rejects.toThrow(/No mail transport configured/);
  });

  it("writes the sink file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "oath-mail-"));
    const r = await deliverMail(msg, { env: { MAIL_SINK_DIR: dir } });
    expect(r.delivered).toBe("sink");
    if (r.delivered === "sink") expect(readFileSync(r.path, "utf8")).toContain("Subject: Hello");
  });

  it("posts to the provider with the key and sender, and returns the message id", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "msg_1" }), { status: 200 }));
    const r = await deliverMail(msg, { env: { MAIL_PROVIDER: "resend", RESEND_API_KEY: "re_test", MAIL_FROM: "OathSteps <no-reply@example.com>" }, fetch: fetchMock as unknown as typeof fetch });
    expect(r).toEqual({ delivered: "resend", id: "msg_1" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body as string)).toEqual({ from: "OathSteps <no-reply@example.com>", to: ["learner@example.com"], subject: "Hello", text: "Body" });
  });

  it("requires the key and sender, and never leaks the response body on failure", async () => {
    await expect(deliverMail(msg, { env: { MAIL_PROVIDER: "resend" } })).rejects.toThrow(/RESEND_API_KEY and MAIL_FROM/);
    const bad = vi.fn(async () => new Response('{"message":"bad address learner@example.com"}', { status: 422 }));
    const err = await deliverMail(msg, { env: { MAIL_PROVIDER: "resend", RESEND_API_KEY: "k", MAIL_FROM: "a@b.co" }, fetch: bad as unknown as typeof fetch }).catch((e: Error) => e);
    expect((err as Error).message).toBe("Mail provider rejected the message (HTTP 422).");
  });
});
