import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@/generated/prisma/client";

function sqlitePath(): string {
  const url = process.env.DATABASE_URL ?? "file:./data/oathsteps.db";
  if (!url.startsWith("file:")) throw new Error("DATABASE_URL must be a file: URL for the SQLite adapter (see docs/OPERATIONS.md for PostgreSQL).");
  const p = resolve(/*turbopackIgnore: true*/ process.cwd(), url.slice("file:".length));
  mkdirSync(/*turbopackIgnore: true*/ dirname(p), { recursive: true });
  return p;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: sqlitePath() }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
