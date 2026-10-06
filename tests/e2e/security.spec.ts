import { expect, test } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers";

test.describe("security headers and request boundaries", () => {
  test("pages carry CSP and anti-framing headers; API responses are never cacheable", async ({ request }) => {
    const home = await request.get("/");
    expect(home.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(home.headers()["x-frame-options"]).toBe("DENY");
    expect(home.headers()["x-content-type-options"]).toBe("nosniff");
    const sw = await request.get("/sw.js");
    expect(sw.headers()["cache-control"]).toContain("no-store");
    const api = await request.get("/api/sync");
    expect(api.status()).toBe(401);
    expect(api.headers()["cache-control"]).toContain("no-store");
    const account = await request.delete("/api/account");
    expect(account.status()).toBe(401);
  });

  test("a signed-in session cannot be driven cross-origin, and bad bodies are rejected", async ({ page }) => {
    await signUp(page, uniqueEmail("sec"));
    const cross = await page.request.post("/api/sync", { headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" }, data: { events: [] } });
    expect(cross.status()).toBe(403);
    const bad = await page.request.post("/api/sync", { data: { events: [{ eventId: "nope", type: "attempt", payload: {}, createdAt: "x" }] } });
    expect(bad.status()).toBe(400);
    const notJson = await page.request.post("/api/sync", { headers: { "content-type": "application/json" }, data: "{not json" });
    expect(notJson.status()).toBe(400);
    const eventId = crypto.randomUUID();
    const ok = await page.request.post("/api/sync", { data: { events: [{ eventId, type: "bookmark", payload: { questionId: "2025-001", bookmarked: true }, createdAt: new Date().toISOString() }] } });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).stored).toEqual([eventId]);
    // Replaying the same event is a no-op, not a second record.
    const again = await page.request.post("/api/sync", { data: { events: [{ eventId, type: "bookmark", payload: { questionId: "2025-001", bookmarked: true }, createdAt: new Date().toISOString() }] } });
    expect((await again.json()).duplicate).toEqual([eventId]);
  });

  test("a native client signs in with a signed bearer token; unsigned or missing tokens are refused", async ({ playwright, baseURL }) => {
    const signup = await playwright.request.newContext({ baseURL });
    const res = await signup.post("/api/auth/sign-up/email", { data: { email: uniqueEmail("native"), password: "correct-horse-battery-10", name: "Native" } });
    expect(res.status()).toBe(200);
    const token = res.headers()["set-auth-token"];
    expect(token).toContain(".");
    await signup.dispose();

    // A fresh context has no cookies and sends no Origin, like the iOS app.
    const api = await playwright.request.newContext({ baseURL });
    const auth = { authorization: `Bearer ${token}` };
    expect((await api.get("/api/sync", { headers: auth })).status()).toBe(200);
    const push = await api.post("/api/sync", { headers: auth, data: { events: [{ eventId: "22222222-2222-4222-8222-222222222222", type: "journey", payload: { interview: { status: "scheduled", date: "2026-11-18" } }, createdAt: "2026-10-05T12:00:00.000Z" }] } });
    expect(push.status()).toBe(200);
    expect((await push.json()).stored).toHaveLength(1);
    expect((await api.get("/api/sync", { headers: { authorization: `Bearer ${token.split(".")[0]}` } })).status()).toBe(401);
    expect((await api.get("/api/sync")).status()).toBe(401);
    expect((await api.delete("/api/account", { headers: auth })).status()).toBe(200);
    expect((await api.get("/api/sync", { headers: auth })).status()).toBe(401);
    await api.dispose();
  });
});
