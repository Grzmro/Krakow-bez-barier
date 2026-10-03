import { expect, test } from "./fixtures";

const NEAR_PLANTY = { latitude: 50.0648, longitude: 19.9402, accuracy: 20 };
const BY_KRZYSZTOFORY = { latitude: 50.0626, longitude: 19.9384, accuracy: 20 };

test.describe("next to the Planty toilet", () => {
  test.use({ geolocation: NEAR_PLANTY, permissions: ["geolocation"] });

  test("one press of 'Najbliższa toaleta' shows the nearest accessible toilet with its facts and 'Prowadź', by keyboard", async ({
    page,
    expectAccessible,
    evidence,
  }) => {
    // GIVEN the home screen with location access granted but "W mojej okolicy" off
    await page.goto("/");
    const list = page.getByRole("region", { name: "Lista miejsc" });
    const actions = list.getByRole("group", { name: "Szybkie akcje" });
    const toilet = actions.getByRole("button", { name: "Najbliższa toaleta" });
    await expect(list.getByRole("heading", { level: 2, name: "9 miejsc" })).toBeVisible();

    // WHEN a keyboard user presses "Najbliższa toaleta" once
    await toilet.focus();
    await page.keyboard.press("Enter");

    // THEN location, category and filter are set at once and the nearest accessible toilet is shown and announced
    await expect(toilet).toHaveAttribute("aria-pressed", "true");
    await expect(list.getByRole("button", { name: "W mojej okolicy" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("group", { name: "Kategorie" }).getByRole("button", { name: "Toalety" })).toHaveAttribute("aria-pressed", "true");
    await expect(list.getByRole("group", { name: "Filtry cech" }).getByRole("button", { name: "Toaleta dostosowana" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const result = list.getByRole("region", { name: "Najbliższa toaleta dostosowana" });
    await expect(result).toContainText("Toaleta publiczna Planty (przykład)");
    await expect(result).toContainText(/\d+ m od Ciebie/);
    await expect(result).toContainText("Przykład");
    // This example place has only list data, so its summary stands in for the fact card.
    await expect(result).toContainText("Toaleta dostosowana");
    await expect(result.getByRole("link", { name: "Prowadź" })).toHaveAttribute("href", /^\/trasa\?do=/);
    await expect(
      page.getByRole("status").filter({ hasText: /^Najbliższa toaleta dostosowana: Toaleta publiczna Planty \(przykład\), \d+ m od Ciebie/ }),
    ).toBeAttached();
    await expect(toilet).toBeFocused();
    await expect(page.locator("main")).toMatchAriaSnapshot({ name: "home-quick.aria.yml" });
    await expectAccessible();
    await evidence("home-quick");

    // WHEN they press it again
    await page.keyboard.press("Enter");

    // THEN the result is gone and the list shows every category again, still near them
    await expect(toilet).toHaveAttribute("aria-pressed", "false");
    await expect(result).toHaveCount(0);
    await expect(list.getByRole("button", { name: "W mojej okolicy" })).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("next to a museum whose lift nobody described", () => {
  test.use({ geolocation: BY_KRZYSZTOFORY, permissions: ["geolocation"] });

  test("'Najbliższa winda' never presents a place without data as having a lift", async ({ page, expectAccessible }) => {
    // GIVEN the home screen next to Pałac Krzysztofory (lift: no data), with Sukiennice (lift) a little farther
    await page.goto("/");
    const list = page.getByRole("region", { name: "Lista miejsc" });

    // WHEN the user presses "Najbliższa winda" and also asks to see places without data
    await list.getByRole("button", { name: "Najbliższa winda" }).click();
    const result = list.getByRole("region", { name: "Najbliższe miejsce z windą" });
    await expect(result).toContainText("Sukiennice");
    await expect(result.getByRole("listitem")).toContainText(/Winda.*Źródło: OpenStreetMap.*Pozyskano \d+\.\d+\.\d{4}/);
    await list.getByRole("switch", { name: "Pokaż też miejsca bez danych" }).click();

    // THEN the nearer place without data is listed first as "Brak danych", but the result still names Sukiennice
    const rows = page.locator("#lista > ul > li");
    await expect(rows.first()).toContainText("Pałac Krzysztofory");
    await expect(rows.first()).toContainText("Brak danych");
    await expect(result).toContainText("Sukiennice");
    await expect(result).not.toContainText("Pałac Krzysztofory");
    await expectAccessible();
  });
});

test("without location a quick action asks for it or a district, and stops are marked as not yet available", async ({
  page,
  expectAccessible,
}) => {
  // GIVEN a browser that refuses location access
  await page.goto("/");
  await page.evaluate(() => {
    navigator.geolocation.getCurrentPosition = (_ok, fail) =>
      fail?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
  });
  const list = page.getByRole("region", { name: "Lista miejsc" });
  await expect(page.getByRole("status")).toHaveText("Znaleziono 9 miejsc");

  // WHEN the user presses "Najbliższa toaleta"
  await list.getByRole("button", { name: "Najbliższa toaleta" }).click();

  // THEN they are told why there is no result, with the refusal help and the district picker open
  const result = list.getByRole("region", { name: "Najbliższa toaleta dostosowana" });
  await expect(result).toContainText("włącz „W mojej okolicy” albo wybierz dzielnicę");
  await expect(list.getByRole("group", { name: "Brak zgody na lokalizację." })).toBeVisible();
  await expect(list.getByRole("button", { name: "Albo wybierz dzielnicę" })).toHaveAttribute("aria-expanded", "true");

  // WHEN they choose Stare Miasto
  await list.getByLabel("Dzielnica").selectOption({ label: "Stare Miasto" });
  await list.getByRole("button", { name: "Pokaż okolicę" }).click();

  // THEN the nearest accessible toilet is measured from that point
  await expect(result).toContainText("Toaleta publiczna Planty (przykład)");
  await expect(result).toContainText("od wybranego punktu");

  // WHEN they press "Najbliższy przystanek", whose data is not switched on yet
  const stop = list.getByRole("button", { name: /Najbliższy przystanek/ });
  await expect(stop).toHaveAttribute("aria-disabled", "true");
  await expect(stop).toHaveAccessibleDescription(/Przystanki pokażemy po włączeniu danych ZTP/);
  await stop.focus();
  await page.keyboard.press("Enter");

  // THEN it says the stops are coming, never that there are no stops nearby
  const stopResult = list.getByRole("region", { name: "Najbliższy przystanek bez schodów" });
  await expect(stopResult).toContainText("To nie znaczy, że w pobliżu nie ma przystanków.");
  await expect(stopResult).not.toContainText("brak w okolicy");
  await expectAccessible();
});
