import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>["db"];

/**
 * Neon's connection dialog adds `channel_binding=require`; postgres.js would send it to the server as a
 * startup parameter and Postgres rejects it. SSL stays governed by `sslmode`.
 */
export function normalizeDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete("channel_binding");
  return parsed.toString();
}

export function createDb(url = process.env.DATABASE_URL, options: postgres.Options<Record<string, never>> = {}) {
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  const client = postgres(normalizeDatabaseUrl(url), options);
  return { db: drizzle(client, { schema }), close: () => client.end() };
}
