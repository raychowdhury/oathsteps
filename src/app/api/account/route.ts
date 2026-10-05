import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/prisma";
import { json, requireUser } from "@/server/request";
import { deleteUserData, snapshot } from "@/server/sync";

export const dynamic = "force-dynamic";

const consentSchema = z.object({ purpose: z.enum(["migrate-guest-progress", "sync"]), version: z.string().min(1).max(20) });

/** Record a consent decision (e.g. before migrating guest progress). */
export async function POST(req: Request) {
  const who = await requireUser(req);
  if (who instanceof NextResponse) return who;
  const parsed = consentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid consent record" }, 400);
  await prisma.consent.create({ data: { userId: who.userId, purpose: parsed.data.purpose, version: parsed.data.version } });
  return json({ ok: true });
}

/** Server-side export of everything stored for this account. */
export async function GET(req: Request) {
  const who = await requireUser(req);
  if (who instanceof NextResponse) return who;
  const [data, consents, user] = await Promise.all([snapshot(prisma, who.userId), prisma.consent.findMany({ where: { userId: who.userId } }), prisma.user.findUnique({ where: { id: who.userId }, select: { email: true, name: true, createdAt: true } })]);
  return json({ exportedAt: new Date().toISOString(), account: user, consents, ...data });
}

/** Delete the account and every synced record. Local data is cleared by the client. */
export async function DELETE(req: Request) {
  const who = await requireUser(req);
  if (who instanceof NextResponse) return who;
  await deleteUserData(prisma, who.userId);
  return json({ ok: true, deleted: true, note: "Account, sessions and all synced learning records were deleted. Backups, if any, are rotated by the operator's retention policy (see docs/OPERATIONS.md)." });
}
