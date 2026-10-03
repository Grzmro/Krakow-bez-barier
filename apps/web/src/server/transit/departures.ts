import type { TransitDeparture, TransitStop, VehicleAccessibility } from "@krakow-bez-barier/contracts";
import { distanceMeters } from "@/lib/place-features";
import type { FeedConfig, FeedData } from "./feed";
import type { RtVehicle } from "./gtfs-rt";

export type DepartureOptions = {
  radiusMeters: number;
  /** Stop names returned, nearest first. */
  maxStops?: number;
  maxDeparturesPerStop?: number;
  /** Departures further ahead are left out. */
  horizonSeconds?: number;
};

const iso = (seconds: number) => new Date(seconds * 1000).toISOString();

/** What a departure says about its vehicle; unknown never becomes accessible. */
export function vehicleAccessibility(
  feed: FeedConfig,
  vehicle: RtVehicle | undefined,
  observedAt: number | undefined,
): VehicleAccessibility {
  const base = { label: vehicle?.label ?? vehicle?.id ?? null, observedAt: observedAt ? iso(observedAt) : null };
  switch (vehicle?.wheelchair) {
    case 2:
      return feed.trustsAccessibleFlag
        ? { ...base, state: "accessible", reliability: "confirmed" }
        : { ...base, state: "unverified", reliability: "inferred" };
    case 3:
      return { ...base, state: "inaccessible", reliability: "confirmed" };
    default:
      return { ...base, state: "no_data", reliability: null };
  }
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
  { radiusMeters, maxStops = 3, maxDeparturesPerStop = 6, horizonSeconds = 3600 }: DepartureOptions,
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
            vehicle: vehicleAccessibility(feed.feed, vehicle, position?.timestamp ?? feed.timestamp),
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
