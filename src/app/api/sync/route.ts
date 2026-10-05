import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { json, requireUser } from "@/server/request";
import { snapshot, storeEvents, validatePush } from "@/server/sync";

export const dynamic = "force-dynamic";

/** Push outbox events. Idempotent per eventId. */
export async function POST(req: Request) {
  const who = await requireUser(req);
  if (who instanceof NextResponse) return who;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }
  const v = validatePush(body);
  if (!v.ok) return json({ error: v.error }, 400);
  const result = await storeEvents(prisma, who.userId, v.events);
  return json({ ...result, rejected: [...v.rejected, ...result.rejected] });
}

/** Pull everything for this user (used after sign-in to restore on a new device). */
export async function GET(req: Request) {
  const who = await requireUser(req);
  if (who instanceof NextResponse) return who;
  return json(await snapshot(prisma, who.userId));
}
