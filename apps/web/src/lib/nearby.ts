import type { DevicePosition } from "@/lib/native/geolocation";
import { distanceMeters } from "@/lib/place-features";

/** Grid the search area snaps to (0.01° ≈ 1.1 km north–south, ≈ 0.7 km east–west in Kraków). */
const GRID_DEG = 0.01;
/** Half-size of the area around the snapped point: ≈ 2.2 km in both directions in Kraków. */
const HALF_LAT_DEG = 0.02;
const HALF_LON_DEG = 0.03;

const snap = (value: number) => Math.round(value / GRID_DEG) * GRID_DEG;
const fixed = (value: number) => Number(value.toFixed(2));

/**
 * The coarse area "W mojej okolicy" asks the API for, as `minLon,minLat,maxLon,maxLat`. The centre snaps to
 * a 0.01° grid, so the server only learns a ~1 km cell, never the device position (US-6.6); distances and
 * the order of the list are computed on the device from the exact position.
 */
export function searchArea({ latitude, longitude }: Pick<DevicePosition, "latitude" | "longitude">): [number, number, number, number] {
  const lat = snap(latitude);
  const lon = snap(longitude);
  return [fixed(lon - HALF_LON_DEG), fixed(lat - HALF_LAT_DEG), fixed(lon + HALF_LON_DEG), fixed(lat + HALF_LAT_DEG)];
}

/** `[lon, lat]` of a device position, the order the API and the map use. */
export function toLonLat({ latitude, longitude }: Pick<DevicePosition, "latitude" | "longitude">): [number, number] {
  return [longitude, latitude];
}

/** Places with their distance from `origin` (`[lon, lat]`), nearest first. */
export function byDistance<T extends { location: { coordinates: number[] } }>(
  places: T[],
  origin: [number, number],
): { place: T; distance: number }[] {
  return places
    .map((place) => ({ place, distance: distanceMeters(origin, place.location.coordinates) }))
    .sort((a, b) => a.distance - b.distance);
}
