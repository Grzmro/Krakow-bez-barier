// Runs only against a migrated database whose name contains "test":
// TEST_DATABASE_URL=postgres://…/kbb_test npx vitest run near-database
import { createDb, places } from "@krakow-bez-barier/db";
import { like } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createDbPlaceRepository } from "./repository";
import { listPlaces } from "./service";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url || !/test/i.test(new URL(url).pathname))("GET /places near (database)", () => {
  const handle = url ? createDb(url) : undefined;
  afterAll(async () => {
    await handle?.db.delete(places).where(like(places.externalRef, "near-test:%"));
    await handle?.close();
  });

  it("returns the nearest of more than a thousand places first and pages by distance", async () => {
    // GIVEN 1100 places on a grid in an empty corner of the map, named against their distance
    const { db } = handle!;
    const run = randomUUID();
    const origin: [number, number] = [-100, 10];
    const rows = Array.from({ length: 1100 }, (_, i) => ({
      externalRef: `near-test:${run}:${i}`,
      name: `Near test ${run} ${String(1099 - i).padStart(4, "0")}`,
      category: "museum" as const,
      location: { x: origin[0] + (i % 40) * 0.001, y: origin[1] + Math.floor(i / 40) * 0.001 },
    }));
    for (let at = 0; at < rows.length; at += 500) await db.insert(places).values(rows.slice(at, at + 500));
    const bbox: [number, number, number, number] = [origin[0] - 0.01, origin[1] - 0.01, origin[0] + 0.05, origin[1] + 0.05];
    const point: [number, number] = [origin[0] + 0.0203, origin[1] + 0.0147];
    const deps = { repository: createDbPlaceRepository(db) };
    const planar = ([x, y]: number[]) => Math.hypot((x - point[0]) * Math.cos((point[1] * Math.PI) / 180), y - point[1]);

    // WHEN two pages are read near the point
    const first = await listPlaces({ bbox, near: point, limit: 50 }, deps);
    const second = await listPlaces({ bbox, near: point, limit: 50, cursor: first.nextCursor! }, deps);

    // THEN they hold the 100 nearest places, nearest first, with no overlap
    const shown = [...first.items, ...second.items].map((item) => planar(item.location.coordinates));
    expect(new Set([...first.items, ...second.items].map((p) => p.id)).size).toBe(100);
    // (the spheroid and this planar estimate may swap places that are metres apart)
    shown.forEach((d, i) => expect(d).toBeGreaterThanOrEqual((shown[i - 1] ?? 0) - 1e-4));
    const nearest = rows.map((r) => planar([r.location.x, r.location.y])).sort((a, b) => a - b);
    expect(Math.max(...shown)).toBeCloseTo(nearest[99], 3);
    expect(first.total).toBe(1100);
  });
});
