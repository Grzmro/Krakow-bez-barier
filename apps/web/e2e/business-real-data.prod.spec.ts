import type { PlaceList } from "@krakow-bez-barier/contracts";
import { pl } from "../src/i18n/pl";
import { expect, test } from "./fixtures";

// Runs against `next start` of the real-API build (project chromium-prod, E2E_PROD=1) and the database in
// DATABASE_URL; skips itself only when DATABASE_URL is unset (CI). Read-only, so it can run against a shared database.

test("the business page previews the widget of a real place, without sample labels", async ({
  page,
  request,
  expectAccessible,
  evidence,
}) => {
  // GIVEN a real hotel from the places API
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is unset — no database to read real places from (npm run db:setup)");
  const response = await request.get("/api/v1/places?category=hotel&limit=1");
  expect(response.ok(), `GET /api/v1/places answered ${response.status()}`).toBe(true);
  const [hotel] = ((await response.json()) as PlaceList).items;
  test.skip(!hotel, "the database has no hotel");

  // WHEN the visitor opens the home screen
  await page.goto("/");

  // THEN the app lists real places
  await expect(page.getByRole("region", { name: "Lista miejsc" }).getByRole("heading", { level: 2 })).toHaveText(/^\d+ miejsc/);

  // WHEN they open the business page for that hotel
  await page.goto(`/dla-firm?miejsce=${encodeURIComponent(hotel.id)}`);

  // THEN the preview, the embed code and the API example are that place's, and nothing is labelled PRZYKŁAD
  const widget = page.frameLocator(`iframe[title="${pl.business.page.iframeTitle(hotel.name)}"]`);
  await expect(widget.getByRole("heading", { name: hotel.name })).toBeVisible();
  await expect(page.getByRole("region", { name: pl.business.page.codeLabel })).toContainText(`/widget/${hotel.id}`);
  await expect(page.getByText(`GET /api/v1/widget/${hotel.id}`)).toBeVisible();
  await expect(page.getByText(pl.common.sample.tag, { exact: true })).toHaveCount(0);
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "business-real.aria.yml" });
  await expectAccessible();
  await evidence("business-real-data");

  // WHEN no place is named in the address
  await page.goto("/dla-firm");

  // THEN the preview falls back to a real hotel, never the spec's sample hotel
  await expect(page.getByText(/GET \/api\/v1\/widget\/[0-9a-f-]{36}$/)).toBeVisible();
});
