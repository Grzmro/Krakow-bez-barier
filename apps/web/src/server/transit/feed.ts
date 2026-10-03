import type { RtTripUpdate, RtVehiclePosition } from "./gtfs-rt";
import type { GtfsStatic } from "./gtfs-static";

export type TransitMode = "tram" | "bus";

/** One of the operator's GTFS feeds: `GTFS_KRK_<id>.zip` plus `TripUpdates_<id>.pb` and `VehiclePositions_<id>.pb`. */
export type FeedConfig = {
  id: string;
  mode: TransitMode;
  /**
   * Whether `wheelchair_accessible = WHEELCHAIR_ACCESSIBLE` is believed for this feed. ZTP flags every tram as
   * accessible (122 of 122 on 2026-10-03, high-floor ones included), so for trams it reads as a default.
   */
  trustsAccessibleFlag: boolean;
};

/** ZTP Kraków: MPK trams (T), MPK buses (A), Mobilis buses (M). */
export const ZTP_FEEDS: FeedConfig[] = [
  { id: "T", mode: "tram", trustsAccessibleFlag: false },
  { id: "A", mode: "bus", trustsAccessibleFlag: true },
  { id: "M", mode: "bus", trustsAccessibleFlag: true },
];

/** Everything the departures need from one feed at one moment. */
export type FeedData = GtfsStatic & {
  feed: FeedConfig;
  /** POSIX seconds the realtime data was produced at (the older of the two realtime files). */
  timestamp: number;
  tripUpdates: RtTripUpdate[];
  vehicles: RtVehiclePosition[];
};

/** Loads a feed's current data: the live operator files, or a recording. Throws when the feed can't be read. */
export interface TransitFeedProvider {
  readonly kind: "live" | "recorded";
  load(feed: FeedConfig): Promise<FeedData>;
}

/** Source metadata shown with every answer (`Source` in the API). */
export const ZTP_SOURCE = {
  id: "ztp-gtfs-rt",
  name: "ZTP Kraków: GTFS i GTFS-Realtime",
  kind: "official_open_data",
  // No licence or terms are published next to the feeds (gtfs.ztp.krakow.pl, checked 2026-10-03).
  license: "Do sprawdzenia",
  licenseConfirmed: false,
  attribution: "Zarząd Transportu Publicznego w Krakowie",
  url: "https://gtfs.ztp.krakow.pl",
  refreshInterval: "30 s",
} as const;
