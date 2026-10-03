import type { components } from "@krakow-bez-barier/contracts";
import { sql } from "drizzle-orm";
import { getDb, isDbConfigured } from "./db";

export type Health = components["schemas"]["Health"];
export type HealthCheck = components["schemas"]["HealthCheck"];

const DB_TIMEOUT_MS = 2000;

/** Never throws: a failing database is reported as `down`, so health stays answerable without one. */
export async function probeDatabase(): Promise<HealthCheck> {
  if (!isDbConfigured()) return { status: "not_configured", latencyMs: null, detail: "DATABASE_URL is not set." };
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      getDb().execute(sql`select 1`),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), DB_TIMEOUT_MS);
      }),
    ]);
    return { status: "up", latencyMs: Math.round(performance.now() - started), detail: null };
  } catch (error) {
    const reason =
      error instanceof Error && error.message === "timeout"
        ? `Database did not answer within ${DB_TIMEOUT_MS} ms.`
        : `Database query failed${errorCode(error)}.`;
    return { status: "down", latencyMs: null, detail: reason };
  } finally {
    clearTimeout(timer);
  }
}

// Only the error code: messages can carry the host, port or user from the connection string.
// Drizzle wraps driver errors, so the code may sit on `cause`.
function errorCode(error: unknown): string {
  for (let e = error as { code?: unknown; cause?: unknown } | null; e; e = e.cause as typeof e) {
    if (typeof e.code === "string") return ` (${e.code})`;
  }
  return "";
}

export async function checkHealth(probe: () => Promise<HealthCheck> = probeDatabase): Promise<Health> {
  const database = await probe();
  return {
    status: database.status === "up" ? "ok" : "degraded",
    time: new Date().toISOString(),
    checks: { database },
  };
}
