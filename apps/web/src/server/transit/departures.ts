import type {
  Reliability,
  TransitDeparture,
  TransitStop,
  VehicleAccessibility,
  VehicleEvidence,
} from "@krakow-bez-barier/contracts";
import { distanceMeters } from "@/lib/place-features";
import type { FeedConfig, FeedData } from "./feed";
import { FLEET_RELIABILITY, fleetEntriesFor, type FleetEntry } from "./fleet";
import type { RtVehicle } from "./gtfs-rt";

export type DepartureOptions = {
  radiusMeters: number;
  /** Stop names returned, nearest first. */
  maxStops?: number;
  maxDeparturesPerStop?: number;
  /** Departures further ahead are left out. */
  horizonSeconds?: number;
  /** City fleet configuration; entries of a source whose licence is unconfirmed are dropped when `production`. */
  fleet?: FleetEntry[];
  production?: boolean;
};

const iso = (seconds: number) => new Date(seconds * 1000).toISOString();

const RANK: Record<Reliability, number> = { confirmed: 0, community: 1, extracted: 2, user_report: 3, inferred: 4, sample: 5 };

/**
 * What a departure says about its vehicle. The statements are the operator's flag (when this feed's flag means
 * something), the vehicle's fleet type and a carrier declaration; `entries` are the fleet entries already matched to
 * this vehicle. Agreeing statements make one fact with every source, disagreeing ones a conflict that shows all of them,
 * a declaration alone stays "declared" — and missing data never becomes accessible.
 */
export function vehicleAccessibility(
  feed: FeedConfig,
  vehicle: RtVehicle | undefined,
  observedAt: number | undefined,
  entries: FleetEntry[] = [],
): VehicleAccessibility {
  const base = { label: vehicle?.label ?? vehicle?.id ?? null, observedAt: observedAt ? iso(observedAt) : null };
  const evidence: VehicleEvidence[] = [];
  if (vehicle?.wheelchair === 3) {
    evidence.push({ kind: "operator_flag", accessible: false, reliability: "confirmed", detail: null });
  } else if (vehicle?.wheelchair === 2 && feed.trustsAccessibleFlag) {
    evidence.push({ kind: "operator_flag", accessible: true, reliability: "confirmed", detail: null });
  }
  for (const entry of entries) {
    evidence.push({
      kind: entry.kind,
      accessible: entry.lowFloor,
      reliability: FLEET_RELIABILITY[entry.kind],
      detail: entry.model,
    });
  }

  if (evidence.length === 0) {
    // A default flag stays visible as "unverified"; no flag at all is "no data".
    return vehicle?.wheelchair === 2
      ? { ...base, state: "unverified", reliability: "inferred", evidence }
      : { ...base, state: "no_data", reliability: null, evidence };
  }
  const best = evidence.reduce((a, b) => (RANK[b.reliability] < RANK[a.reliability] ? b : a)).reliability;
  if (new Set(evidence.map((e) => e.accessible)).size > 1) return { ...base, state: "conflict", reliability: best, evidence };
  if (evidence.every((e) => e.kind === "carrier_declaration")) return { ...base, state: "declared", reliability: best, evidence };
  return { ...base, state: evidence[0].accessible ? "accessible" : "inaccessible", reliability: best, evidence };
}

type Platform = { feed: FeedData; id: string; name: string; platform: string | null; lon: number; lat: number; distance: number };

/**
 * Stops within the radius of `[lon, lat]`, grouped by name (a stop's platforms for trams and buses share it), with the
 * departures due between `now` and the horizon from any of their platforms. A trip's last stop is not a departure,
 * and a trip without a known line is left out.
 */
export function nearbyDepartures(
  feeds: FeedData[],
  point: [number, number],
  now: number,
  { radiusMeters, maxStops = 3, maxDeparturesPerStop = 6, horizonSeconds = 3600, fleet = [], production = false }: DepartureOptions,
): TransitStop[] {
  const platforms: Platform[] = [];
  for (const feed of feeds) {
    for (const stop of feed.stops) {
      const distance = distanceMeters(point, [stop.lon, stop.lat]);
      if (distance <= radiusMeters) platforms.push({ feed, ...stop, distance });
    }
  }
  const byName = new Map<string, Platform[]>();
  for (const p of platforms.sort((a, b) => a.distance - b.distance)) {
    byName.set(p.name, [...(byName.get(p.name) ?? []), p]);
  }

  return [...byName.values()].slice(0, maxStops).map((group) => {
    const nearest = group[0];
    const departures: TransitDeparture[] = [];
    for (const feed of new Set(group.map((p) => p.feed))) {
      const here = new Map(group.filter((p) => p.feed === feed).map((p) => [p.id, p]));
      const positions = new Map(feed.vehicles.map((v) => [v.trip?.tripId, v]));
      for (const update of feed.tripUpdates) {
        const tripId = update.trip.tripId;
        if (!tripId) continue;
        update.stopTimes.forEach((stopTime, index) => {
          const platform = stopTime.stopId ? here.get(stopTime.stopId) : undefined;
          const at = stopTime.departure ?? stopTime.arrival;
          if (!platform || at === undefined || stopTime.scheduleRelationship === 1) return;
          if (index === update.stopTimes.length - 1 || at < now || at > now + horizonSeconds) return;
          const [routeId, headsign] = feed.trips[tripId] ?? [update.trip.routeId, undefined];
          const line = (routeId && feed.routes[routeId]) || routeId;
          // A trip the timetable doesn't know (it changes daily) has no line to show; better left out than "?".
          if (!line) return;
          const position = positions.get(tripId);
          const vehicle =
            [update.vehicle, position?.vehicle].find((v) => v?.wheelchair !== undefined) ?? position?.vehicle ?? update.vehicle;
          departures.push({
            tripId,
            mode: feed.feed.mode,
            line,
            headsign: headsign || null,
            platform: platform.platform,
            departureAt: iso(at),
            delaySeconds: stopTime.delaySeconds ?? null,
            vehicle: vehicleAccessibility(
              feed.feed,
              vehicle,
              position?.timestamp ?? feed.timestamp,
              fleetEntriesFor(fleet, feed.feed.id, vehicle?.label ?? vehicle?.id, { production }),
            ),
          });
        });
      }
    }
    departures.sort((a, b) => a.departureAt.localeCompare(b.departureAt) || a.line.localeCompare(b.line));
    return {
      id: `${nearest.feed.feed.id}:${nearest.id}`,
      name: nearest.name,
      location: { type: "Point", coordinates: [nearest.lon, nearest.lat] },
      distanceMeters: nearest.distance,
      departures: departures.slice(0, maxDeparturesPerStop),
    };
  });
}
