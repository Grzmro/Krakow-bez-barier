import type { SimulatedSourceOutage } from "@krakow-bez-barier/contracts";
import { isDbConfigured } from "@/server/db";
import { HttpError } from "@/server/http";
import type { ModeratorPrincipal } from "@/server/reports/moderator-auth";
import { simulatedOutageIds } from "@/server/sources";
import { sourceOutagesStore } from "./drizzle-store";
import type { SimulationRecord, SourceOutagesStore } from "./store";

/** How long a simulated outage lasts after it is switched on, so a demo never leaves a lasting "outage" behind. */
export const SIMULATION_MINUTES = 15;

const toApi = (record: SimulationRecord): SimulatedSourceOutage => ({
  sourceId: record.sourceId,
  sourceName: record.sourceName,
  startedBy: record.startedBy,
  startedAt: record.startedAt.toISOString(),
  endsAt: record.endsAt.toISOString(),
  stoppedAt: record.stoppedAt?.toISOString() ?? null,
});

export async function listSimulations(store: SourceOutagesStore, now: Date = new Date()): Promise<SimulatedSourceOutage[]> {
  return (await store.listRunning(now)).map(toApi);
}

/**
 * Switches on (or restarts) a simulated outage of a source for `SIMULATION_MINUTES`. User reports are not fetched
 * from anywhere, so they have nothing to fail: 404 like an unknown source.
 */
export async function startSimulation(
  store: SourceOutagesStore,
  sourceId: string,
  principal: ModeratorPrincipal,
  now: Date = new Date(),
): Promise<SimulatedSourceOutage> {
  const source = await store.findSource(sourceId);
  if (!source || source.kind === "user_report") {
    throw new HttpError(404, { detail: `Source "${sourceId}" does not exist or is not fetched from outside.` });
  }
  const endsAt = new Date(now.getTime() + SIMULATION_MINUTES * 60_000);
  return toApi(await store.start({ sourceId, moderator: principal.name, at: now, endsAt }));
}

export async function stopSimulation(
  store: SourceOutagesStore,
  sourceId: string,
  principal: ModeratorPrincipal,
  now: Date = new Date(),
): Promise<SimulatedSourceOutage> {
  const stopped = await store.stop({ sourceId, moderator: principal.name, at: now });
  if (!stopped) throw new HttpError(404, { detail: `No simulated outage of "${sourceId}" is running.` });
  return toApi(stopped);
}

/**
 * Sources shown in outage right now: the operator's `SIMULATE_SOURCE_OUTAGE` plus the moderators' running
 * simulations. Read from the database on every call, so every server instance agrees. A failed read (e.g. the
 * migration not applied yet) is logged and leaves only the config, never fails the request.
 */
export async function currentSimulatedOutageIds(
  store: () => SourceOutagesStore = sourceOutagesStore,
  now: Date = new Date(),
  configured: readonly string[] = simulatedOutageIds(),
  dbConfigured: boolean = isDbConfigured(),
): Promise<string[]> {
  if (!dbConfigured) return [...configured];
  try {
    const running = (await store().listRunning(now)).map((r) => r.sourceId);
    return [...new Set([...configured, ...running])];
  } catch (error) {
    console.error("Reading simulated source outages failed", error);
    return [...configured];
  }
}
