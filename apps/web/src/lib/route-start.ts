/**
 * Where a route starts: Dworzec Główny (the default), the device position, a point from a shared link, or a place from
 * our database. Positions are `[lon, lat]`.
 */
export type RouteStart =
  | { kind: "station" }
  | { kind: "me"; position: [number, number] }
  | { kind: "point"; position: [number, number] }
  | { kind: "place"; id: string; name?: string; position?: [number, number] };

export const STATION: RouteStart = { kind: "station" };

const COORDINATES = /^(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/;

/**
 * The start in `?z=`: a place id, or `lat,lon`. Anything else, out-of-range coordinates included, is the default start,
 * so a mangled link still opens a route.
 */
export function parseStart(param: string | undefined): RouteStart {
  const value = param?.trim();
  if (!value) return STATION;
  const coordinates = COORDINATES.exec(value);
  if (coordinates) {
    const lat = Number(coordinates[1]);
    const lon = Number(coordinates[2]);
    return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { kind: "point", position: [lon, lat] } : STATION;
  }
  return value.length <= 200 ? { kind: "place", id: value } : STATION;
}

// 0.001° is ≈ 110 m north–south and ≈ 70 m east–west in Kraków: a shared link never carries the exact device position.
const round = (value: number) => Number(value.toFixed(3));

/** The `?z=` value for a start, `undefined` for the default one. A position is rounded to ~100 m. */
export function startParam(start: RouteStart): string | undefined {
  switch (start.kind) {
    case "station":
      return undefined;
    case "place":
      return start.id;
    default: {
      const [lon, lat] = start.position;
      return `${round(lat)},${round(lon)}`;
    }
  }
}
