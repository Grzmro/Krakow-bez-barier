import { expect, test } from "./fixtures";

test.use({ viewport: { width: 390, height: 844 } });

test("the list panel collapses to a bar, leaves the map in view and brings the list back", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the home screen on a phone with the list at half height
  await page.goto("/");
  const list = page.getByRole("region", { name: "Lista miejsc" });
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("9 miejsc");
  const half = (await list.boundingBox())!;

  // WHEN the visitor hides the list with the keyboard
  const hide = page.getByRole("button", { name: "Schowaj listę" });
  await hide.focus();
  await page.keyboard.press("Enter");

  // THEN only a bar with the count remains, the map nearly fills the screen and its controls stay clear of the bar
  const show = list.getByRole("button", { name: "Pokaż listę" });
  await expect(show).toHaveAttribute("aria-expanded", "false");
  await expect(show).toBeFocused();
  await expect(list.getByRole("paragraph").filter({ hasText: "9 miejsc" })).toBeVisible();
  await expect(list.getByRole("link")).toHaveCount(0);
  await expect.poll(async () => (await list.boundingBox())!.height).toBeLessThan(half.height / 3);
  const bar = (await list.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(bar.y + bar.height).toBeGreaterThanOrEqual(viewport.height - 1);
  const zoomIn = (await page.getByRole("button", { name: "Przybliż" }).boundingBox())!;
  const attribution = (await page.getByRole("link", { name: /OpenStreetMap/ }).first().boundingBox())!;
  for (const box of [zoomIn, attribution]) expect(box.y + box.height).toBeLessThanOrEqual(bar.y);
  await expect(page.getByRole("button", { name: "Przybliż" })).toBeInViewport();
  await expect(page.locator("[data-place-id]").first()).toBeVisible();
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "home-stowed.aria.yml" });
  await expectAccessible();
  await evidence("home-list-stowed");

  // AND the state survives a reload of the session
  await page.reload();
  await expect(list.getByRole("button", { name: "Pokaż listę" })).toBeVisible();

  // WHEN they show the list again
  await list.getByRole("button", { name: "Pokaż listę" }).press("Enter");

  // THEN the places are listed and reachable again
  await expect(list.getByRole("button", { name: "Schowaj listę" })).toBeFocused();
  await expect(list.getByRole("button", { name: "Schowaj listę" })).toHaveAttribute("aria-expanded", "true");
  await expect(list.getByRole("link", { name: /Sukiennice/ })).toBeVisible();
  await expect(list.getByRole("button", { name: "Rozwiń arkusz" })).toHaveAttribute("aria-expanded", "false");
});

test("selecting a pin while the list is hidden shows that place in the list", async ({ page }) => {
  // GIVEN the list hidden
  await page.goto("/");
  const list = page.getByRole("region", { name: "Lista miejsc" });
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("9 miejsc");
  await page.getByRole("button", { name: "Schowaj listę" }).click();
  await expect(list.getByRole("button", { name: "Pokaż listę" })).toBeVisible();

  // WHEN they tap a pin on the map (pins overlap at this zoom, so the click is dispatched on the pin itself)
  await page.locator('[data-place-id="sukiennice"]').dispatchEvent("click");

  // THEN the list comes back at half height with that place focused
  await expect(list.getByRole("button", { name: "Schowaj listę" })).toBeVisible();
  await expect(list.getByRole("link", { name: /Sukiennice/ })).toBeFocused();
  await expect(list.getByRole("link", { name: /Sukiennice/ })).toBeInViewport();
  await expect(page.locator('[data-place-id="sukiennice"]')).toHaveAttribute("data-selected", "true");
});

test("the skip link brings a hidden list back before focusing it", async ({ page }) => {
  // GIVEN the list hidden
  await page.goto("/");
  await page.getByRole("button", { name: "Schowaj listę" }).click();

  // WHEN a keyboard user follows "Przejdź do listy"
  const skip = page.getByRole("link", { name: "Przejdź do listy" });
  await skip.focus();
  await page.keyboard.press("Enter");

  // THEN the list is shown and focused
  await expect(page.locator("#lista")).toBeFocused();
  await expect(page.getByRole("button", { name: "Schowaj listę" })).toBeVisible();
});

test("on desktop a stowed flag from the session is ignored and no stow button is shown", async ({ page }) => {
  // GIVEN a session that stowed the list on a phone
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => sessionStorage.setItem("kbb-list-stowed", "1"));

  // WHEN the home screen opens at desktop width
  await page.goto("/");

  // THEN the side panel lists the places and has no stow buttons
  const list = page.getByRole("region", { name: "Lista miejsc" });
  await expect(list.getByRole("link", { name: /Sukiennice/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Schowaj listę|Pokaż listę/ })).toHaveCount(0);
});
