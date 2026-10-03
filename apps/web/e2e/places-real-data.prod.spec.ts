import type { Place, PlaceList } from "@krakow-bez-barier/contracts";
import { pl } from "../src/i18n/pl";
import { CARD_ATTRIBUTES } from "../src/lib/place-facts";
import { expect, test } from "./fixtures";

// Runs against `next start` of the real-API build (project chromium-prod, E2E_PROD=1) and the database in
// DATABASE_URL (`npm run db:setup` seeds it). Without a database the places API fails and the spec skips itself.
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
  const response = await request.get("/api/v1/places?limit=100");
  test.skip(!response.ok(), `GET /api/v1/places answered ${response.status()} — no seeded database (npm run db:setup)`);
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
  await expect(page.locator("[data-place-id]").first()).toBeAttached();
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
