import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "./auth";
import { allowRequest } from "./sync";

export const PRIVATE_HEADERS = { "Cache-Control": "no-store, private", "Content-Type": "application/json" } as const;

export function json(body: unknown, status = 200): NextResponse {
  return new NextResponse(JSON.stringify(body), { status, headers: PRIVATE_HEADERS });
}

/** Same-origin check for state-changing requests (defence in depth beyond SameSite cookies). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(req.url).host;
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
