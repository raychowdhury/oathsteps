import { defineConfig, env } from "prisma/config";

// Prisma 7 does not load .env on its own. Node 20.12+ can, without a dependency.
try {
  process.loadEnvFile?.(".env");
} catch {
  // No .env (CI sets DATABASE_URL directly).
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
