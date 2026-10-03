import type { Place, PlaceList } from "@krakow-bez-barier/contracts";
import { pl } from "../src/i18n/pl";
import { parseOsmRecordRef } from "../src/lib/place-facts";
import { expect, test } from "./fixtures";

// Runs against `next start` of the real-API build (E2E_PROD=1) and the database in DATABASE_URL; skips itself only
// when DATABASE_URL is unset (CI). Read-only: it opens a card and never follows the link to openstreetmap.org.

test("a place card with ingested OSM facts links to edit that object in OpenStreetMap", async ({
  page,
  request,
  expectAccessible,
  evidence,
}) => {
  // GIVEN a place from the database whose fact came from OSM, with the recordRef ingest stores (osm:… prefix)
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is unset — no database to read real places from (npm run db:setup)");
  const response = await request.get("/api/v1/places?limit=100");
  expect(response.ok(), `GET /api/v1/places answered ${response.status()}`).toBe(true);
  const { items } = (await response.json()) as PlaceList;
  let target: { place: Place; recordRef: string; sourceUrl: string } | undefined;
  for (const item of items) {
    const place = (await (await request.get(`/api/v1/places/${item.id}`)).json()) as Place;
    const fact = place.attributes
      .flatMap((a) => a.facts)
      .find((f) => f.source.kind === "community" && f.source.recordRef?.startsWith("osm:"));
    const sourceUrl = place.sources.find((s) => s.id === fact?.source.id)?.url;
    if (fact?.source.recordRef && sourceUrl) {
      target = { place, recordRef: fact.source.recordRef, sourceUrl };
      break;
    }
  }
  test.skip(!target, "the database has no place with an ingested OSM fact");
  const { place, recordRef, sourceUrl } = target!;
  const osm = parseOsmRecordRef(recordRef)!;
  const expected = new URL(`/edit?${osm.type}=${osm.id}`, sourceUrl).toString();

  // WHEN the visitor opens its card
  await page.goto(`/miejsca/${place.id}`);
  await expect(page.getByRole("heading", { level: 1, name: place.name })).toBeVisible();

  // THEN "Edytuj w OpenStreetMap" points at that exact OSM object, explained by its hint
  const link = page.getByRole("link", { name: pl.place.editOsm });
  await expect(link).toHaveAttribute("href", expected);
  await expect(link).toHaveAccessibleDescription(pl.place.editOsmHint);
  await expect(link.locator("..")).toMatchAriaSnapshot({ name: "osm-edit.aria.yml" });

  // AND it is reachable by keyboard
  await link.focus();
  await expect(link).toBeFocused();
  await link.scrollIntoViewIfNeeded();
  await expectAccessible();
  await evidence("place-osm-edit");
});
