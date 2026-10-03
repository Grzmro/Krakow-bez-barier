import { createDb, type Db } from "@krakow-bez-barier/db";

type DbHandle = ReturnType<typeof createDb>;

// Survives dev hot reloads, which re-evaluate modules and would otherwise open a new pool each time.
const globalForDb = globalThis as typeof globalThis & { kbbDb?: DbHandle };

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Shared Drizzle client for server code. Throws when `DATABASE_URL` is not set (see `.env.example`). */
export function getDb(): Db {
  // prepare: false keeps a pooled (pgbouncer, transaction mode) connection string working; a few
  // connections per instance are enough on serverless, where every instance has its own pool.
  globalForDb.kbbDb ??= createDb(process.env.DATABASE_URL, {
    connect_timeout: 5,
    prepare: false,
    max: process.env.VERCEL ? 3 : 10,
    idle_timeout: 20,
  });
  return globalForDb.kbbDb.db;
}
