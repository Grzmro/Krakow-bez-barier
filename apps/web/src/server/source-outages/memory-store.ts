import type { SourceKind } from "@krakow-bez-barier/contracts";
import type { SimulationRecord, SourceOutagesStore } from "./store";

type MemorySimulation = Omit<SimulationRecord, "sourceName"> & { stoppedBy: string | null };

/** In-memory `SourceOutagesStore` for tests — same contract as the Drizzle store, no database. */
export function createMemorySourceOutagesStore(seed: { sources: { id: string; name: string; kind?: SourceKind }[] }) {
  const simulations: MemorySimulation[] = [];

  const record = (s: MemorySimulation): SimulationRecord => ({
    sourceId: s.sourceId,
    sourceName: seed.sources.find((source) => source.id === s.sourceId)?.name ?? s.sourceId,
    startedBy: s.startedBy,
    startedAt: s.startedAt,
    endsAt: s.endsAt,
    stoppedAt: s.stoppedAt,
  });
  const running = (now: Date) => (s: MemorySimulation) => !s.stoppedAt && s.endsAt.getTime() > now.getTime();
  const newestFirst = (a: MemorySimulation, b: MemorySimulation) => b.startedAt.getTime() - a.startedAt.getTime();

  const store: SourceOutagesStore = {
    async findSource(id) {
      const source = seed.sources.find((s) => s.id === id);
      return source ? { id: source.id, name: source.name, kind: source.kind ?? "official_open_data" } : null;
    },
    async listRunning(now) {
      return simulations.filter(running(now)).sort(newestFirst).map(record);
    },
    async start({ sourceId, moderator, at, endsAt }) {
      const current = simulations.filter((s) => s.sourceId === sourceId && running(at)(s)).sort(newestFirst)[0];
      if (current) {
        current.endsAt = endsAt;
        return record(current);
      }
      const created: MemorySimulation = { sourceId, startedBy: moderator, startedAt: at, endsAt, stoppedAt: null, stoppedBy: null };
      simulations.push(created);
      return record(created);
    },
    async stop({ sourceId, moderator, at }) {
      const stopped = simulations.filter((s) => s.sourceId === sourceId && running(at)(s)).sort(newestFirst);
      for (const s of stopped) Object.assign(s, { stoppedAt: at, stoppedBy: moderator });
      return stopped[0] ? record(stopped[0]) : null;
    },
  };

  return { store, simulations };
}
