import type { FeedConfig, FeedData, TransitFeedProvider } from "./feed";
import { decodeFeed } from "./gtfs-rt";
import { readGtfsZip, type GtfsStatic } from "./gtfs-static";

type Fetch = typeof fetch;

export type LiveProviderOptions = {
  baseUrl: string;
  fetch?: Fetch;
  /** The timetable zips change daily at most; re-read them after this long. */
  staticMaxAgeMs?: number;
  timeoutMs?: number;
};

const USER_AGENT = "KrakowBezBarier/1.0 (HackYeah 2026; transit departures)";

/** Reads the operator's files over HTTP: the GTFS zip (cached) and both realtime files on every load. */
export function createLiveProvider({
  baseUrl,
  fetch: fetchImpl = fetch,
  staticMaxAgeMs = 12 * 3_600_000,
  timeoutMs = 10_000,
}: LiveProviderOptions): TransitFeedProvider {
  const base = baseUrl.replace(/\/$/, "");
  const statics = new Map<string, { loadedAt: number; data: Promise<GtfsStatic> }>();

  const download = async (file: string): Promise<Uint8Array> => {
    const response = await fetchImpl(`${base}/${file}`, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length) throw new Error(`${file}: empty`);
    return bytes;
  };

  const staticFor = (feed: FeedConfig): Promise<GtfsStatic> => {
    const cached = statics.get(feed.id);
    if (cached && Date.now() - cached.loadedAt < staticMaxAgeMs) return cached.data;
    const data = download(`GTFS_KRK_${feed.id}.zip`).then(readGtfsZip);
    statics.set(feed.id, { loadedAt: Date.now(), data });
    // A failed download must not stick for the whole cache period; the last good copy is better than none.
    data.catch(() => {
      if (statics.get(feed.id)?.data !== data) return;
      if (cached) statics.set(feed.id, cached);
      else statics.delete(feed.id);
    });
    return data;
  };

  return {
    kind: "live",
    async load(feed): Promise<FeedData> {
      const [stat, trips, positions] = await Promise.all([
        staticFor(feed),
        download(`TripUpdates_${feed.id}.pb`).then(decodeFeed),
        // ZTP sometimes serves an empty positions file; departures still stand, their vehicles then have no data.
        download(`VehiclePositions_${feed.id}.pb`)
          .then(decodeFeed)
          .catch(() => null),
      ]);
      const timestamps = [trips.timestamp, positions?.timestamp].filter((t): t is number => !!t);
      return {
        ...stat,
        feed,
        timestamp: timestamps.length ? Math.min(...timestamps) : Math.floor(Date.now() / 1000),
        tripUpdates: trips.tripUpdates,
        vehicles: positions?.vehicles ?? [],
      };
    },
  };
}
