import { createDb } from "@krakow-bez-barier/db";
import { cities } from "./cities";
import { adapters, resolveTarget } from "./registry";
import { runIngest } from "./runner";
import { drizzleStore } from "./store";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const target = resolveTarget(cities, arg("city"), arg("source"));
if ("error" in target) {
  console.error(target.error);
  process.exit(2);
}
const { city, sourceIds } = target;

const userAgent =
  process.env.INGEST_USER_AGENT ??
  "krakow-bez-barier-ingest/0.1 (HackYeah 2026; https://github.com/Grzmro/Krakow-bez-barier)";

const nonNegativeInt = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n >= 0 && process.env[name] ? n : fallback;
};
const retry = { attempts: Math.max(1, nonNegativeInt("INGEST_FETCH_ATTEMPTS", 3)), baseDelayMs: nonNegativeInt("INGEST_RETRY_BASE_MS", 1000) };
const simulateOutage = (process.env.SIMULATE_SOURCE_OUTAGE ?? "").split(",").map((id) => id.trim()).filter(Boolean);

const { db, close } = createDb();
const store = drizzleStore(db);
let failed = false;
try {
  for (const id of sourceIds) {
    const summary = await runIngest({ adapter: adapters[id], city, store, userAgent, retry, simulateOutage, log: console.log });
    console.log(
      `${id}/${city.id}: ${summary.status} — seen ${summary.recordsSeen}, written ${summary.recordsWritten}, skipped values ${summary.recordsSkipped}${summary.error ? `, error: ${summary.error}` : ""}`,
    );
    if (summary.status === "failed") failed = true;
  }
} finally {
  await close();
}
process.exit(failed ? 1 : 0);
