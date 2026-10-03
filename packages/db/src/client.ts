import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>["db"];

export function createDb(url = process.env.DATABASE_URL, options: postgres.Options<Record<string, never>> = {}) {
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  const client = postgres(url, options);
  return { db: drizzle(client, { schema }), close: () => client.end() };
}
