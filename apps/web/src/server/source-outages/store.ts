import type { SourceKind } from "@krakow-bez-barier/contracts";

/** One switch of the demo "Symuluj awarię źródła", with its source's name. */
export type SimulationRecord = {
  sourceId: string;
  sourceName: string;
  startedBy: string;
  startedAt: Date;
  endsAt: Date;
  stoppedAt: Date | null;
};

export type StartInput = { sourceId: string; moderator: string; at: Date; endsAt: Date };
export type StopInput = { sourceId: string; moderator: string; at: Date };

/** Persistence of simulated source outages; `drizzle-store.ts` in the app, `memory-store.ts` in tests. */
export interface SourceOutagesStore {
  findSource(id: string): Promise<{ id: string; name: string; kind: SourceKind } | null>;
  /** Simulations running at `now` (not stopped, `endsAt` ahead), newest first. */
  listRunning(now: Date): Promise<SimulationRecord[]>;
  /** Restarts the clock of the source's running simulation (`endsAt`), or starts a new one when none runs. */
  start(input: StartInput): Promise<SimulationRecord>;
  /** Stops the source's running simulations; the newest one stopped, `null` when none was running. */
  stop(input: StopInput): Promise<SimulationRecord | null>;
}
