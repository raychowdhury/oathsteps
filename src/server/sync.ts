import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";

/** Wire format for one outbox event. Payloads are opaque JSON but bounded in size. */
export const eventSchema = z.object({
  eventId: z.string().uuid().or(z.string().regex(/^mock:[0-9a-f-]{36}$/)),
  // "journey" carries the seven milestone slots the clients send; "milestone" stays accepted for older clients.
  type: z.enum(["attempt", "review", "mock", "journey", "milestone", "checklist", "english", "profile", "dynamic-answer", "bookmark", "report"]),
  payload: z.unknown(),
  createdAt: z.string().datetime(),
});
export const pushSchema = z.object({
  events: z.array(eventSchema).min(1).max(500),
});
export type SyncEvent = z.infer<typeof eventSchema>;

export const MAX_PAYLOAD_BYTES = 16 * 1024;

/** Validate a push body. Returns accepted events and the ids rejected with a reason; never throws on bad input. */
export function validatePush(body: unknown): { ok: true; events: SyncEvent[]; rejected: { eventId: string; reason: string }[] } | { ok: false; error: string } {
  const parsed = pushSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ") };
  const events: SyncEvent[] = [];
  const rejected: { eventId: string; reason: string }[] = [];
  for (const e of parsed.data.events) {
    const size = Buffer.byteLength(JSON.stringify(e.payload ?? null));
    if (size > MAX_PAYLOAD_BYTES) rejected.push({ eventId: e.eventId, reason: `payload too large (${size} bytes)` });
    else events.push(e);
  }
  return { ok: true, events, rejected };
}

/**
 * Store events for a user. Replaying the same eventId is a no-op (idempotent), and an event id
 * that already belongs to another user is rejected rather than overwritten.
 */
export async function storeEvents(db: PrismaClient, userId: string, events: SyncEvent[]): Promise<{ stored: string[]; duplicate: string[]; rejected: { eventId: string; reason: string }[] }> {
  const ids = events.map((e) => e.eventId);
  const existing = await db.learningEvent.findMany({ where: { eventId: { in: ids } }, select: { eventId: true, userId: true } });
  const byId = new Map(existing.map((e) => [e.eventId, e.userId]));
  const stored: string[] = [];
  const duplicate: string[] = [];
  const rejected: { eventId: string; reason: string }[] = [];
  const toCreate = [];
  for (const e of events) {
    const owner = byId.get(e.eventId);
    if (owner === userId) duplicate.push(e.eventId);
    else if (owner) rejected.push({ eventId: e.eventId, reason: "event id belongs to another account" });
    else {
      toCreate.push({ eventId: e.eventId, userId, type: e.type, payload: JSON.stringify(e.payload ?? null), clientAt: new Date(e.createdAt) });
      stored.push(e.eventId);
    }
  }
  if (toCreate.length) await db.learningEvent.createMany({ data: toCreate });
  const profile = events.filter((e) => e.type === "profile").at(-1);
  if (profile) {
    const data = JSON.stringify(profile.payload ?? {});
    await db.serverProfile.upsert({ where: { userId }, create: { userId, data }, update: { data } });
  }
  return { stored, duplicate, rejected };
}

export async function snapshot(db: PrismaClient, userId: string): Promise<{ events: { eventId: string; type: string; payload: unknown; createdAt: string }[]; profile: unknown | null }> {
  const [events, profile] = await Promise.all([
    db.learningEvent.findMany({ where: { userId }, orderBy: { clientAt: "asc" }, select: { eventId: true, type: true, payload: true, clientAt: true } }),
    db.serverProfile.findUnique({ where: { userId } }),
  ]);
  return {
    events: events.map((e) => ({ eventId: e.eventId, type: e.type, payload: JSON.parse(e.payload), createdAt: e.clientAt.toISOString() })),
    profile: profile ? JSON.parse(profile.data) : null,
  };
}

/** Delete every record for a user: auth rows cascade from User, learning data cascades too. */
export async function deleteUserData(db: PrismaClient, userId: string): Promise<void> {
  await db.user.delete({ where: { id: userId } });
}

// ponytail: single-instance in-memory limiter; swap for a shared store if the app ever runs on more than one node.
const buckets = new Map<string, { tokens: number; at: number }>();
export function allowRequest(key: string, now = Date.now(), perMinute = 60): boolean {
  const b = buckets.get(key) ?? { tokens: perMinute, at: now };
  const refill = ((now - b.at) / 60_000) * perMinute;
  b.tokens = Math.min(perMinute, b.tokens + refill);
  b.at = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  return true;
}
