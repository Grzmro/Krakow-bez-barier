import { strFromU8, unzipSync } from "fflate";

// The few static GTFS tables the departures need: where stops are, and which line and headsign a trip has.

export type GtfsStop = { id: string; name: string; platform: string | null; lat: number; lon: number };

export type GtfsStatic = {
  stops: GtfsStop[];
  /** `route_id` → `route_short_name`. */
  routes: Record<string, string>;
  /** `trip_id` → `[route_id, trip_headsign]`. */
  trips: Record<string, [string, string]>;
};

const TABLES = ["stops.txt", "routes.txt", "trips.txt"] as const;

/** Parses RFC 4180 CSV (quoted fields, doubled quotes, CRLF) into rows of named columns. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) rows.push([...row, field]);
  const [header = [], ...data] = rows;
  const names = header.map((h) => h.replace(/^﻿/, "").trim());
  return data.map((cells) => Object.fromEntries(names.map((name, i) => [name, cells[i] ?? ""])));
}

/** Builds the lookup tables from the three GTFS files' text. Rows without an id or coordinates are skipped. */
export function buildStatic(files: Record<(typeof TABLES)[number], string>): GtfsStatic {
  const stops: GtfsStop[] = [];
  for (const row of parseCsv(files["stops.txt"])) {
    const lat = Number(row.stop_lat);
    const lon = Number(row.stop_lon);
    // location_type 1+ are stations, entrances and nodes, not places to board.
    if (!row.stop_id || !row.stop_lat || !row.stop_lon || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (row.location_type && row.location_type !== "0") continue;
    stops.push({ id: row.stop_id, name: row.stop_name, platform: row.stop_desc || null, lat, lon });
  }
  const routes: GtfsStatic["routes"] = {};
  for (const row of parseCsv(files["routes.txt"])) {
    if (row.route_id) routes[row.route_id] = row.route_short_name || row.route_long_name || row.route_id;
  }
  const trips: GtfsStatic["trips"] = {};
  for (const row of parseCsv(files["trips.txt"])) {
    if (row.trip_id) trips[row.trip_id] = [row.route_id, row.trip_headsign];
  }
  return { stops, routes, trips };
}

/** Reads stops, routes and trips from a GTFS zip; the large tables (stop_times, shapes) are never inflated. */
export function readGtfsZip(zip: Uint8Array): GtfsStatic {
  const files = unzipSync(zip, { filter: (file) => (TABLES as readonly string[]).includes(file.name) });
  const missing = TABLES.filter((name) => !files[name]);
  if (missing.length) throw new Error(`GTFS zip without ${missing.join(", ")}`);
  return buildStatic({
    "stops.txt": strFromU8(files["stops.txt"]),
    "routes.txt": strFromU8(files["routes.txt"]),
    "trips.txt": strFromU8(files["trips.txt"]),
  });
}
