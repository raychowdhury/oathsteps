import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { allowRequest, deleteUserData, snapshot, storeEvents, validatePush } from "./sync";

let prisma: PrismaClient;
const T = "2026-01-10T10:00:00.000Z";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "oathsteps-"));
  const file = join(dir, "test.db");
  const raw = new Database(file);
  const migrations = join(process.cwd(), "prisma", "migrations");
  for (const m of readdirSync(migrations).filter((d) => !d.endsWith(".toml")).sort()) raw.exec(readFileSync(join(migrations, m, "migration.sql"), "utf8"));
  raw.close();
  prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: file }) });
  await prisma.user.createMany({ data: [{ id: "u1", name: "A", email: "a@example.test" }, { id: "u2", name: "B", email: "b@example.test" }] });
});
afterAll(async () => prisma?.$disconnect());

describe("validatePush", () => {
  it("rejects malformed bodies and oversized payloads without throwing", () => {
    expect(validatePush({})).toMatchObject({ ok: false });
    expect(validatePush({ events: [] })).toMatchObject({ ok: false });
    expect(validatePush({ events: [{ eventId: "not-a-uuid", type: "attempt", payload: {}, createdAt: T }] })).toMatchObject({ ok: false });
    const big = validatePush({ events: [{ eventId: uuid(1), type: "attempt", payload: { blob: "x".repeat(20_000) }, createdAt: T }] });
    expect(big).toMatchObject({ ok: true, events: [], rejected: [{ eventId: uuid(1) }] });
    expect(validatePush({ events: [{ eventId: `mock:${uuid(2)}`, type: "mock", payload: {}, createdAt: T }] })).toMatchObject({ ok: true });
  });
});

describe("event types the clients send", () => {
  it("accepts every outbox type the web and iOS clients produce, including journey", () => {
    const types = ["attempt", "mock", "journey", "checklist", "english", "profile", "dynamic-answer", "bookmark", "report"];
    const r = validatePush({ events: types.map((type, i) => ({ eventId: uuid(900 + i), type, payload: {}, createdAt: T })) });
    expect(r).toMatchObject({ ok: true, rejected: [] });
    if (r.ok) expect(r.events.map((e) => e.type)).toEqual(types);
  });
});

describe("storeEvents", () => {
  it("stores once, treats replays as duplicates, and refuses ids owned by another user", async () => {
    const ev = { eventId: uuid(10), type: "attempt" as const, payload: { questionId: "2025-001" }, createdAt: T };
    const first = await storeEvents(prisma, "u1", [ev]);
    expect(first).toEqual({ stored: [uuid(10)], duplicate: [], rejected: [] });
    const again = await storeEvents(prisma, "u1", [ev]);
    expect(again).toEqual({ stored: [], duplicate: [uuid(10)], rejected: [] });
    const other = await storeEvents(prisma, "u2", [ev]);
    expect(other.rejected).toEqual([{ eventId: uuid(10), reason: "event id belongs to another account" }]);
    expect(await prisma.learningEvent.count()).toBe(1);
  });

  it("isolates snapshots per user and mirrors the latest profile", async () => {
    await storeEvents(prisma, "u2", [{ eventId: uuid(20), type: "profile", payload: { newPerDay: 7 }, createdAt: T }]);
    const s1 = await snapshot(prisma, "u1");
    const s2 = await snapshot(prisma, "u2");
    expect(s1.events.map((e) => e.eventId)).toEqual([uuid(10)]);
    expect(s1.profile).toBeNull();
    expect(s2.events.map((e) => e.eventId)).toEqual([uuid(20)]);
    expect(s2.profile).toEqual({ newPerDay: 7 });
  });

  it("deletes a user's rows without touching others", async () => {
    await deleteUserData(prisma, "u2");
    expect(await prisma.user.findUnique({ where: { id: "u2" } })).toBeNull();
    expect(await prisma.learningEvent.count({ where: { userId: "u2" } })).toBe(0);
    expect(await prisma.learningEvent.count({ where: { userId: "u1" } })).toBe(1);
  });
});

describe("allowRequest", () => {
  it("limits a key to the per-minute budget and refills over time", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) expect(allowRequest("k", now, 5)).toBe(true);
    expect(allowRequest("k", now, 5)).toBe(false);
    expect(allowRequest("k", now + 30_000, 5)).toBe(true);
  });
});
