import { routes } from "../src/lib/routes";
import { expect, test } from "./fixtures";

// Runs against `next start` (project chromium-prod): the service worker is production-only.
test("a route saved on the phone opens offline and can be deleted", async ({
  page,
  context,
  expectAccessible,
  evidence,
}) => {
  // GIVEN a visitor with the service worker on the route screen (Dworzec Główny → Rynek Główny)
  await page.addInitScript(() => {
    window.__kbbServiceWorker = true;
  });
  await page.goto(routes.route());
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("min");

  // WHEN they save the route with the keyboard
  const save = page.getByRole("button", { name: "Zapisz na telefonie" });
  await save.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main").getByText("Trasa zapisana na tym telefonie — otworzysz ją bez internetu.")).toBeVisible();
  await expect(page.locator("main").getByRole("link", { name: "Zapisane trasy" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zapisz ponownie" })).toBeFocused();

  // AND open the saved routes without a connection
  await context.setOffline(true);
  await page.goto(routes.savedRoutes);

  // THEN the route is there, with the date it was planned and a warning that the data may be out of date
  const saved = page.getByRole("article", { name: "Dworzec Główny → Rynek Główny" });
  await expect(saved).toContainText(/Wyznaczona \d{1,2} \S+ \d{4} \d{1,2}:\d{2}\. Dane mogą być nieaktualne/);

  // AND its steps, with facts and sources, open from the keyboard
  await saved.getByRole("button", { name: "Pokaż kroki" }).focus();
  await page.keyboard.press("Enter");
  const steps = saved.getByRole("list", { name: "Odcinki trasy, tekstowa wersja mapy" });
  await expect(steps).toBeVisible();
  await steps.getByRole("button").first().press("Enter");
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "saved-routes.aria.yml" });
  await expectAccessible();
  await evidence("saved-routes-offline");

  // WHEN they delete it
  await saved.getByRole("button", { name: "Usuń trasę Dworzec Główny → Rynek Główny" }).press("Enter");

  // THEN the list is empty, focus returns to the page, and the route stays gone after a reload
  await expect(page.getByText("Nie masz zapisanych tras.")).toBeVisible();
  await expect(page.locator("main#main")).toBeFocused();
  await expect(page.getByRole("status")).toHaveText("Usunięto trasę Dworzec Główny → Rynek Główny.");
  await page.reload();
  await expect(page.getByText("Nie masz zapisanych tras.")).toBeVisible();
  await expectAccessible();
});
