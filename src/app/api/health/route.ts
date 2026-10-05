import { prisma } from "@/server/prisma";

export const dynamic = "force-dynamic";

/** Liveness and database check for the container health check and uptime monitors. Reveals nothing else. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}
