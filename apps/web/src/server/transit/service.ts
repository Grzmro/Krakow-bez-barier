import type { TransitDepartures } from "@krakow-bez-barier/contracts";
import { defaultLocale, type Locale } from "@/i18n/locale";
import { messagesFor } from "@/i18n/messages";
import { simulatedOutageIds } from "@/server/sources";
import { nearbyDepartures } from "./departures";
import { ZTP_FEEDS, ZTP_SOURCE, type FeedConfig, type FeedData, type TransitFeedProvider } from "./feed";
import { createLiveProvider } from "./live-provider";
import { createRecordedProvider } from "./recorded-provider";

/** `radius` is optional only in the type: the request validator applies the spec's default. */
export type DeparturesQuery = { lat: number; lon: number; radius?: number };

const SPEC_DEFAULT_RADIUS_M = 400;
/** Live data older than this is stale even when the operator still answers: its predictions no longer hold. */
const STALE_AFTER_S = 300;

export type TransitServiceOptions = {
  /** `null`: the feed is not served (licence not confirmed in production, or switched off). */
  provider: TransitFeedProvider | null;
  feeds?: FeedConfig[];
  /** A feed read more recently than this is not read again. */
  refreshMs?: number;
  /** Demo switch: every read fails as if the operator were down; the last data stays. */
  simulateOutage?: () => boolean;
  now?: () => Date;
};

type FeedState = {
  feed: FeedConfig;
  data?: FeedData;
  failed: boolean;
  lastAttemptAt?: Date;
  /** When our read of the feed last succeeded; `data.timestamp` is when the operator produced that data. */
  lastSuccessAt?: Date;
  inflight?: Promise<void>;
};

export type TransitService = { departures(query: DeparturesQuery, locale?: Locale): Promise<TransitDepartures> };

export function createTransitService({
  provider,
  feeds = ZTP_FEEDS,
  refreshMs = 30_000,
  simulateOutage = () => false,
  now = () => new Date(),
}: TransitServiceOptions): TransitService {
  const states = new Map<string, FeedState>(feeds.map((feed) => [feed.id, { feed, failed: false }]));

  const refresh = (feed: FeedConfig, state: FeedState): Promise<void> => {
    if (!provider) return Promise.resolve();
    if (state.inflight) return state.inflight;
    if (state.lastAttemptAt && now().getTime() - state.lastAttemptAt.getTime() < refreshMs) return Promise.resolve();
    state.lastAttemptAt = now();
    state.inflight = (async () => {
      try {
        if (simulateOutage()) throw new Error("simulated outage (SIMULATE_SOURCE_OUTAGE)");
        state.data = await provider.load(feed);
        state.failed = false;
        state.lastSuccessAt = now();
      } catch (error) {
        state.failed = true;
        console.error(`[transit] feed ${feed.id}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        state.inflight = undefined;
      }
    })();
    return state.inflight;
  };

  return {
    async departures({ lat, lon, radius }, locale = defaultLocale) {
      const notes = messagesFor(locale).transit.statusNote;
      await Promise.all(feeds.map((feed) => refresh(feed, states.get(feed.id)!)));
      const all = [...states.values()];
      const loaded = all.flatMap((s) => (s.data ? [s.data] : []));
      const oldest = loaded.length ? Math.min(...loaded.map((d) => d.timestamp)) : null;
      const newest = loaded.length ? Math.max(...loaded.map((d) => d.timestamp)) : null;
      const fetchedAt = oldest === null ? null : new Date(oldest * 1000).toISOString();
      const attempts = all.flatMap((s) => (s.lastAttemptAt ? [s.lastAttemptAt.getTime()] : []));
      const successes = all.flatMap((s) => (s.lastSuccessAt ? [s.lastSuccessAt.getTime()] : []));
      const failedFeeds = all.filter((s) => s.failed);
      // One feed down (say Mobilis) doesn't make the others' fresh data an outage: that is named in the note instead.
      const failed = failedFeeds.length > 0 && failedFeeds.length === all.length;
      const failedModes = [...new Set(failedFeeds.map((s) => s.feed.mode))];
      const partial = !failed && failedModes.length > 0 ? notes.partialOutage(failedModes) : null;
      const stale = provider?.kind === "live" && oldest !== null && now().getTime() / 1000 - oldest > STALE_AFTER_S;
      const { id, name, kind, license, attribution, url, refreshInterval } = ZTP_SOURCE;

      const source: TransitDepartures["source"] = {
        id,
        name,
        kind,
        license,
        attribution,
        url,
        refreshInterval,
        refreshStatus: !provider ? "never" : failed ? "outage" : stale ? "stale" : loaded.length ? "ok" : "never",
        lastSuccessAt: successes.length ? new Date(Math.min(...successes)).toISOString() : null,
        lastAttemptAt: attempts.length ? new Date(Math.max(...attempts)).toISOString() : null,
        statusNote: !provider ? notes.disabled : failed ? notes.outage : (partial ?? (stale ? notes.stale : null)),
        isSample: false,
      };
      if (!provider) return { mode: "disabled", fetchedAt: null, source, stops: [] };

      // A recording is answered as of its own time, so its departures are still upcoming.
      const reference = provider.kind === "recorded" && newest !== null ? newest : Math.floor(now().getTime() / 1000);
      return {
        mode: provider.kind,
        fetchedAt,
        source,
        stops: nearbyDepartures(loaded, [lon, lat], reference, { radiusMeters: radius ?? SPEC_DEFAULT_RADIUS_M }),
      };
    },
  };
}

/**
 * Which provider the server uses. The feed's licence is not confirmed, so a production build never serves it (R3);
 * elsewhere `TRANSIT_FEED` picks `live` (default), `recorded` (tests, e2e) or `off`.
 */
export function transitProvider(env: Record<string, string | undefined> = process.env): TransitFeedProvider | null {
  if (!ZTP_SOURCE.licenseConfirmed && env.NODE_ENV === "production") return null;
  const mode = env.TRANSIT_FEED || "live";
  if (mode === "off") return null;
  if (mode === "recorded") return createRecordedProvider();
  return createLiveProvider({ baseUrl: env.ZTP_GTFS_BASE_URL || ZTP_SOURCE.url });
}

let service: TransitService | undefined;

/** The server's one service, so every request shares the feed cache. */
export function getTransitService(): TransitService {
  service ??= createTransitService({
    provider: transitProvider(),
    simulateOutage: () => simulatedOutageIds().includes(ZTP_SOURCE.id),
  });
  return service;
}
