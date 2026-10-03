import { createDb, type Db } from "@krakow-bez-barier/db";

type DbHandle = ReturnType<typeof createDb>;

// Survives dev hot reloads, which re-evaluate modules and would otherwise open a new pool each time.
const globalForDb = globalThis as typeof globalThis & { kbbDb?: DbHandle };

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Shared Drizzle client for server code. Throws when `DATABASE_URL` is not set (see `.env.example`). */
export function getDb(): Db {
  globalForDb.kbbDb ??= createDb(process.env.DATABASE_URL, { connect_timeout: 5 });
  return globalForDb.kbbDb.db;
}
