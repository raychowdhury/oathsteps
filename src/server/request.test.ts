import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth", () => ({ auth: { api: { getSession: async () => null } } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { sameOrigin } = await import("./request");

const req = (headers: Record<string, string>, url = "http://localhost:3100/api/sync") => new Request(url, { method: "POST", headers });

describe("sameOrigin", () => {
  afterEach(() => {
    delete process.env.BETTER_AUTH_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("accepts the host the browser used even when the server listens on a different name", () => {
    expect(sameOrigin(req({ origin: "http://127.0.0.1:3100", host: "127.0.0.1:3100" }))).toBe(true);
    expect(sameOrigin(req({ origin: "https://app.example", host: "internal:3000", "x-forwarded-host": "app.example" }))).toBe(true);
  });

  it("accepts the configured public URL", () => {
    process.env.BETTER_AUTH_URL = "https://oathsteps.example";
    expect(sameOrigin(req({ origin: "https://oathsteps.example", host: "10.0.0.5:3000" }))).toBe(true);
  });

  it("rejects foreign origins and cross-site fetch metadata", () => {
    expect(sameOrigin(req({ origin: "https://evil.example", host: "127.0.0.1:3100" }))).toBe(false);
    expect(sameOrigin(req({ origin: "http://127.0.0.1:3100", host: "127.0.0.1:3100", "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(sameOrigin(req({ origin: "not a url", host: "127.0.0.1:3100" }))).toBe(false);
  });

  it("allows requests without an Origin header (non-browser clients rely on the session check)", () => {
    expect(sameOrigin(req({ host: "127.0.0.1:3100" }))).toBe(true);
  });
});
