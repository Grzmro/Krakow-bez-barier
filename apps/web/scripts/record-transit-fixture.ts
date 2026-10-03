// Records ZTP's GTFS + GTFS-Realtime feeds for the transit tests and e2e (no test ever calls ZTP), cut to the city
// centre so the fixture stays small. The file name carries the date; point `recorded-provider.ts` at a new one.
//
//   npm run transit:record -w apps/web
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { ZTP_FEEDS, ZTP_SOURCE, type FeedData } from "../src/server/transit/feed";
import { createLiveProvider } from "../src/server/transit/live-provider";
import type { TransitRecording } from "../src/server/transit/recorded-provider";

// Stare Miasto, Kazimierz, Stradom and the stations around them (demo area plus about 1 km).
const BOX = { minLon: 19.9, minLat: 50.035, maxLon: 19.99, maxLat: 50.075 };

function cut(data: FeedData): TransitRecording["feeds"][string] {
  const stops = data.stops.filter(
    (s) => s.lon >= BOX.minLon && s.lon <= BOX.maxLon && s.lat >= BOX.minLat && s.lat <= BOX.maxLat,
  );
  const kept = new Set(stops.map((s) => s.id));
  // The trip's last stop stays: it tells the departures apart from arrivals at the terminus.
  const tripUpdates = data.tripUpdates
    .map((u) => ({ ...u, stopTimes: u.stopTimes.filter((st, i) => i === u.stopTimes.length - 1 || kept.has(st.stopId ?? "")) }))
    .filter((u) => u.stopTimes.some((st) => kept.has(st.stopId ?? "")));
  const tripIds = new Set(tripUpdates.map((u) => u.trip.tripId));
  const trips = Object.fromEntries(Object.entries(data.trips).filter(([id]) => tripIds.has(id)));
  const routeIds = new Set(Object.values(trips).map(([routeId]) => routeId));
  for (const u of tripUpdates) if (u.trip.routeId) routeIds.add(u.trip.routeId);
  return {
    timestamp: data.timestamp,
    stops,
    routes: Object.fromEntries(Object.entries(data.routes).filter(([id]) => routeIds.has(id))),
    trips,
    tripUpdates,
    vehicles: data.vehicles.filter((v) => tripIds.has(v.trip?.tripId)),
  };
}

const provider = createLiveProvider({ baseUrl: process.env.ZTP_GTFS_BASE_URL || ZTP_SOURCE.url, timeoutMs: 60_000 });
const recording: TransitRecording = { recordedAt: new Date().toISOString(), feeds: {} };
for (const feed of ZTP_FEEDS) {
  recording.feeds[feed.id] = cut(await provider.load(feed));
  const f = recording.feeds[feed.id];
  console.log(`${feed.id}: ${f.stops.length} stops, ${f.tripUpdates.length} trips, ${f.vehicles.length} vehicles`);
}
const file = path.join(import.meta.dirname, "..", "src", "server", "transit", "fixtures", `ztp-${recording.recordedAt.slice(0, 10)}.json`);
await writeFile(file, `${JSON.stringify(recording)}\n`);
console.log(`→ ${path.relative(process.cwd(), file)}`);
