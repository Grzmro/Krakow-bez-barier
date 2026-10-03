import type { Place, PlaceList } from "@krakow-bez-barier/contracts";
import { pl } from "../src/i18n/pl";
import { config } from "../src/lib/config";
import { CARD_ATTRIBUTES } from "../src/lib/place-facts";
import { expect, test } from "./fixtures";
import { clusters, pins } from "./map";

// Runs against `next start` of the real-API build (project chromium-prod, E2E_PROD=1) and the database in
// DATABASE_URL (`npm run db:setup` seeds it; playwright.config.ts loads the root .env). It skips itself only when
// DATABASE_URL is unset (CI); with a database configured any failing answer fails the test.
// Read-only on purpose: it opens the report form but never sends it, so it can run against a shared database.

const onCard = (attribute: string) => (CARD_ATTRIBUTES as readonly string[]).includes(attribute);
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("list, map and card show seeded places from the real API with their sources", async ({
  page,
  request,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the places API answers from a database with a place that has a known fact the card lists
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is unset — no database to read real places from (npm run db:setup)");
  const response = await request.get("/api/v1/places?limit=100");
  expect(response.ok(), `GET /api/v1/places answered ${response.status()}`).toBe(true);
  const places = (await response.json()) as PlaceList;
  const summary = places.items.find((item) => item.summary.some((chip) => onCard(chip.attribute) && chip.state !== "unknown"));
  test.skip(!summary, "the database has no place with a known card fact");
  const target = summary!;
  const place = (await (await request.get(`/api/v1/places/${target.id}`)).json()) as Place;
  const fact = place.attributes.find((attribute) => onCard(attribute.attribute) && attribute.facts.length > 0)!;
  const source = fact.facts[0].source.name;
  const name = new RegExp(escape(target.name));

  // WHEN the visitor opens the home screen
  await page.goto("/");
  const list = page.getByRole("region", { name: "Lista miejsc" });

  // THEN the list counts the places the API returned, not the spec's samples, and the map pins them
  await expect(list.getByRole("heading", { level: 2 })).toHaveText(/^\d+ miejsc/);
  await expect(list.getByRole("link", { name: /Przykład/ })).toHaveCount(0);
  await expect(pins(page).or(clusters(page)).first()).toBeAttached();
  // Clustered: a few dozen markers for the whole city, not one DOM element per place
  expect(await page.locator(".maplibregl-marker").count()).toBeLessThan(150);
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "real-home.aria.yml" });
  await expectAccessible();
  await evidence("real-data-home");

  // WHEN they search for the place by its full name (no suggestions are offered for an exact match)
  await page.getByRole("combobox", { name: "Wyszukaj miejsce" }).fill(target.name);

  // THEN it is listed and pinned on the map
  const row = list.getByRole("listitem").filter({ has: page.getByRole("link", { name }) }).first();
  await expect(row).toBeVisible();
  await expect(page.locator(`[data-place-id="${target.id}"]`)).toHaveCount(1);

  // WHEN they pick the wheelchair profile
  await page.getByRole("radio", { name: "Wózek", exact: true }).check();

  // THEN the row carries a verdict in words
  await expect(row).toContainText(new RegExp(Object.values(pl.common.status).join("|")));
  await evidence("real-data-search");

  // WHEN they open the card
  await row.getByRole("link", { name }).click();

  // THEN the card shows the place and, behind a known fact, the source it comes from
  await expect(page).toHaveURL(new RegExp(`/miejsca/${target.id}`));
  await expect(page.getByRole("heading", { level: 1, name: target.name })).toBeVisible();
  const factButton = page.getByRole("button", { name: new RegExp(`^${escape(pl.common.attribute[fact.attribute])}:`) });
  await factButton.click();
  await expect(factButton).toHaveAttribute("aria-expanded", "true");
  const panel = page.locator(`#${await factButton.getAttribute("aria-controls")}`);
  await expect(panel).toContainText(`${pl.common.fact.source}: ${source}`);
  await expectAccessible();
  await evidence("real-data-place-card");

  // AND the report form opens on real data (closed without sending)
  await page.getByRole("listitem").filter({ has: factButton }).getByRole("button", { name: "To się nie zgadza" }).click();
  const drawer = page.getByRole("dialog", { name: "To się nie zgadza" });
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});

test("without a position the list starts with the places nearest the Rynek, not the city's first names", async ({ page }) => {
  // GIVEN a database with places across the city
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is unset — no database to read real places from (npm run db:setup)");
  const firstPage = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/places");

  // WHEN the visitor opens the home screen without sharing their location
  await page.goto("/");

  // THEN the list asks for the places nearest the map's starting point and lists them nearest first
  const response = await firstPage;
  const near = new URL(response.url()).searchParams.getAll("near").map(Number);
  expect(near).toEqual(config.cityCenter);
  const list = page.getByRole("region", { name: "Lista miejsc" });
  const rows = list.getByRole("listitem");
  await expect(rows.first()).toContainText(/od Rynku/);
  const distances = (await rows.allTextContents()).slice(0, 5).map(fromRynek);
  expect(distances).toEqual([...distances].sort((a, b) => a - b));

  // AND when only the first page of the city is listed, the list says the rest is left out
  const body = (await response.json()) as { items: unknown[]; total: number; nextCursor?: string | null };
  const note = list.getByText(/najbliższych Rynku z \d+ miejsc/);
  if (body.nextCursor) await expect(note).toContainText(`Pokazano ${body.items.length} najbliższych Rynku z ${body.total} miejsc`);
  else await expect(note).toBeHidden();
});

function fromRynek(row: string): number {
  const match = /([\d,]+) (m|km) od Rynku/.exec(row);
  if (!match) throw new Error(`no distance in "${row}"`);
  const value = Number(match[1].replace(",", "."));
  return match[2] === "km" ? value * 1000 : value;
}
