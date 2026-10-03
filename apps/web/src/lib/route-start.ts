/**
 * Where a route starts: the device position, a point from a shared link, a place from our database, or Dworzec Główny
 * when picked explicitly. `none` = no start yet: there is no default, so the route is not planned. Positions are
 * `[lon, lat]`.
 */
export type RouteStart =
  | { kind: "none" }
  | { kind: "station" }
  | { kind: "me"; position: [number, number] }
  | { kind: "point"; position: [number, number] }
  | { kind: "place"; id: string; name?: string; position?: [number, number] };

export const NO_START: RouteStart = { kind: "none" };
export const STATION: RouteStart = { kind: "station" };

const STATION_PARAM = "station";

/**
 * What a route is planned from: the start's position, or `null` while there is none (no start chosen, a place start
 * whose position hasn't loaded).
 */
export function startPosition(
  start: RouteStart,
  stationPosition: [number, number],
  placePosition?: [number, number],
): [number, number] | null {
  switch (start.kind) {
    case "none":
      return null;
    case "station":
      return stationPosition;
    case "place":
      return start.position ?? placePosition ?? null;
    default:
      return start.position;
  }
}

const COORDINATES = /^(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/;

/**
 * The start in `?z=`: `station`, a place id, or `lat,lon`. Anything else, out-of-range coordinates included, is no
 * start: the screen uses the device position or asks for a start instead of guessing.
 */
export function parseStart(param: string | undefined): RouteStart {
  const value = param?.trim();
  if (!value) return NO_START;
  if (value === STATION_PARAM) return STATION;
  const coordinates = COORDINATES.exec(value);
  if (coordinates) {
    const lat = Number(coordinates[1]);
    const lon = Number(coordinates[2]);
    return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { kind: "point", position: [lon, lat] } : NO_START;
  }
  return value.length <= 200 ? { kind: "place", id: value } : NO_START;
}

// 0.001° is ≈ 110 m north–south and ≈ 70 m east–west in Kraków: a shared link never carries the exact device position.
const round = (value: number) => Number(value.toFixed(3));

/** The `?z=` value for a start, `undefined` for none. A position is rounded to ~100 m. */
export function startParam(start: RouteStart): string | undefined {
  switch (start.kind) {
    case "none":
      return undefined;
    case "station":
      return STATION_PARAM;
    case "place":
      return start.id;
    default: {
      const [lon, lat] = start.position;
      return `${round(lat)},${round(lon)}`;
    }
  }
}
