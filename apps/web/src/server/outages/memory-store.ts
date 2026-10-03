import type { OutageEquipment, OutageVote } from "@krakow-bez-barier/contracts";
import { randomUUID } from "node:crypto";
import type { OutageRecord } from "@/domain/outages";
import type { OutagesStore } from "./store";

type MemoryOutage = { id: string; placeId: string; equipment: OutageEquipment; createdAt: Date };
type MemoryVote = { outageId: string; vote: OutageVote; createdAt: Date };

/** In-memory `OutagesStore` for tests — same contract as the Drizzle store, no database. */
export function createMemoryOutagesStore(seed: { places: { id: string; externalRef?: string }[] }) {
  const outages: MemoryOutage[] = [];
  const votes: MemoryVote[] = [];

  const record = (outage: MemoryOutage): OutageRecord => {
    const own = votes.filter((v) => v.outageId === outage.id);
    const confirmations = own.filter((v) => v.vote === "still_broken");
    const lastConfirmedAt = Math.max(outage.createdAt.getTime(), ...confirmations.map((v) => v.createdAt.getTime()));
    return {
      id: outage.id,
      placeId: outage.placeId,
      equipment: outage.equipment,
      reportedAt: outage.createdAt,
      confirmations: confirmations.length,
      workingVotes: own.length - confirmations.length,
      lastConfirmedAt: new Date(lastConfirmedAt),
    };
  };

  const newestFirst = (a: MemoryOutage, b: MemoryOutage) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1);

  const store: OutagesStore = {
    async findPlace(ref) {
      const place = seed.places.find((p) => p.id === ref || p.externalRef === ref);
      return place ? { id: place.id } : null;
    },
    async report({ placeId, equipment, at, isActive, mayConfirm }) {
      const [latest] = outages.filter((o) => o.placeId === placeId && o.equipment === equipment).sort(newestFirst);
      if (latest && isActive(record(latest))) {
        if (!mayConfirm(latest.id)) return { record: record(latest), created: false, confirmed: false };
        votes.push({ outageId: latest.id, vote: "still_broken", createdAt: at });
        return { record: record(latest), created: false, confirmed: true };
      }
      const outage = { id: randomUUID(), placeId, equipment, createdAt: at };
      outages.push(outage);
      return { record: record(outage), created: true, confirmed: false };
    },
    async vote({ placeId, outageId, vote, at, isActive }) {
      const outage = outages.find((o) => o.id === outageId && o.placeId === placeId);
      if (!outage) return { kind: "not_found" };
      if (!isActive(record(outage))) return { kind: "inactive", record: record(outage) };
      votes.push({ outageId, vote, createdAt: at });
      return { kind: "voted", record: record(outage) };
    },
    async listRecent(placeIds, since) {
      return outages
        .filter((o) => placeIds.includes(o.placeId))
        .sort(newestFirst)
        .map(record)
        .filter((r) => r.lastConfirmedAt.getTime() >= since.getTime());
    },
  };

  return { store, outages, votes };
}
