import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "./auth";
import { allowRequest } from "./sync";

export const PRIVATE_HEADERS = { "Cache-Control": "no-store, private", "Content-Type": "application/json" } as const;

export function json(body: unknown, status = 200): NextResponse {
  return new NextResponse(JSON.stringify(body), { status, headers: PRIVATE_HEADERS });
}

/**
 * Same-origin check for state-changing requests (defence in depth beyond SameSite cookies).
 * Compares the Origin header with the host the browser actually used (Host / X-Forwarded-Host)
 * and with the configured public URL; `req.url` is not used because Next reports its listen
 * hostname there, which differs from what the browser sees (localhost vs 127.0.0.1, proxies).
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  if (!origin) return true;
  const allowed = new Set<string>();
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) allowed.add(host.toLowerCase());
  for (const u of [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    try {
      if (u) allowed.add(new URL(u).host.toLowerCase());
    } catch {
      // ignore malformed configuration here; auth startup validates it
    }
  }
  try {
    return allowed.has(new URL(origin).host.toLowerCase());
  } catch {
    return false;
  }
}

/** Resolve the signed-in user or respond 401. Applies a per-user rate limit. */
export async function requireUser(req: Request): Promise<{ userId: string } | NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return json({ error: "Sign in required" }, 401);
  if (!allowRequest(`user:${session.user.id}`)) return json({ error: "Too many requests, try again in a minute" }, 429);
  if (req.method !== "GET" && !sameOrigin(req)) return json({ error: "Cross-origin request rejected" }, 403);
  return { userId: session.user.id };
}
