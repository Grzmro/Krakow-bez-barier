import { expect, test } from "./fixtures";
import { gotoAllPlaces, showResults } from "./map";

const WAWEL = { latitude: 50.0541, longitude: 19.9354, accuracy: 20 };
const NOWA_HUTA = { latitude: 50.0722, longitude: 20.0375, accuracy: 20 };

function metres(text: string) {
  const match = /([\d,]+) (m|km) od Ciebie/.exec(text);
  if (!match) throw new Error(`no distance from the user in "${text}"`);
  const value = Number(match[1].replace(",", "."));
  return match[2] === "km" ? value * 1000 : value;
}

test.describe("with location access granted", () => {
  test.use({ geolocation: WAWEL, permissions: ["geolocation"] });

  test("'W mojej okolicy' sorts the list from the user and centres the map on them, by keyboard", async ({
    page,
    expectAccessible,
    evidence,
  }) => {
    // GIVEN the home screen listing distances from Rynek
    await gotoAllPlaces(page);
    const list = page.getByRole("region", { name: "Lista miejsc" });
    await expect(list.getByRole("heading", { level: 2 })).toHaveText("10 miejsc");
    const nearby = list.getByRole("button", { name: "W mojej okolicy" });
    await expect(nearby).toHaveAttribute("aria-pressed", "false");
    await expect(nearby).toHaveAccessibleDescription(/Dokładna pozycja zostaje na urządzeniu/);

    // WHEN a keyboard user turns on "W mojej okolicy"
    await nearby.focus();
    await page.keyboard.press("Enter");

    // THEN the list is sorted nearest first with distances from the user, announced, the map shows "Ty"
    await expect(nearby).toHaveAttribute("aria-pressed", "true");
    await expect(nearby).toBeFocused();
    await showResults(page);
    const rows = list.getByRole("listitem");
    await expect(rows.first()).toContainText("od Ciebie");
    await expect(list).not.toContainText("od Rynku");
    const distances = (await rows.allInnerTexts()).map(metres);
    expect(distances).toEqual(distances.toSorted((a, b) => a - b));
    await expect(page.getByRole("status").filter({ hasText: "W Twojej okolicy, od najbliższych. Znaleziono 10 miejsc" })).toBeAttached();
    await expect(page.locator("[data-you]")).toHaveCount(1);
    await expect(page.locator("main")).toMatchAriaSnapshot({ name: "home-nearby.aria.yml" });
    await expectAccessible();
    await evidence("home-nearby");

    // WHEN they turn it off again
    await nearby.focus();
    await page.keyboard.press("Enter");
    await expect(nearby).toHaveAttribute("aria-pressed", "false");
    await showResults(page);

    // THEN the list is back to distances from Rynek and "Ty" is gone
    await expect(rows.first()).toContainText("od Rynku");
    await expect(page.locator("[data-you]")).toHaveCount(0);
  });
});

test.describe("far from every listed place", () => {
  test.use({ geolocation: NOWA_HUTA, permissions: ["geolocation"] });

  test("'W mojej okolicy' narrows the list to the user's area and says why it is empty", async ({ page, expectAccessible }) => {
    // GIVEN the home screen listing all 9 places, none of them near Nowa Huta
    await gotoAllPlaces(page);
    const list = page.getByRole("region", { name: "Lista miejsc" });
    await expect(list.getByRole("heading", { level: 2 })).toHaveText("10 miejsc");

    // WHEN the user in Nowa Huta turns on "W mojej okolicy"
    await list.getByRole("button", { name: "W mojej okolicy" }).click();
    await showResults(page);

    // THEN only their area is searched: the heading and the list agree, and the empty state names the area
    await expect(list.getByRole("heading", { level: 2 })).toHaveText("0 miejsc");
    await expect(list.getByRole("listitem")).toHaveCount(0);
    await expect(list.getByText("Szukasz tylko w Twojej okolicy (w promieniu ok. 2 km).")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "W Twojej okolicy, od najbliższych. Nie znaleziono miejsc" })).toBeAttached();
    await expectAccessible();

    // WHEN they search the whole city instead
    await list.getByRole("button", { name: "Szukaj w całym Krakowie" }).click();

    // THEN "W mojej okolicy" is off and the same search runs over the whole city
    await expect(list.getByRole("button", { name: "W mojej okolicy" })).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("combobox", { name: "Wyszukaj miejsce" })).toHaveValue("r");
    await expect(list.getByRole("heading", { level: 2 })).toHaveText("10 miejsc");
  });
});

test("'W mojej okolicy' on the list explains a refusal, retries and lets the user pick a district", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN an Android browser that refuses location access, on a search listing all places
  await gotoAllPlaces(page);
  await page.evaluate(() => {
    const calls = { count: 0 };
    Object.assign(window, { geolocationCalls: calls });
    navigator.geolocation.getCurrentPosition = (_ok, fail) => {
      calls.count += 1;
      fail?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
    };
  });
  const list = page.getByRole("region", { name: "Lista miejsc" });
  const nearby = list.getByRole("button", { name: "W mojej okolicy" });
  // The list's own "Znaleziono…" announcement must come first, or it can replace the refusal in the live region.
  await expect(page.getByRole("status")).toHaveText("Znaleziono 10 miejsc");

  // WHEN the user turns on "W mojej okolicy"
  await nearby.click();

  // THEN they learn why and where to allow it on Android, it is announced, and the list still works from Rynek
  const problem = list.getByRole("group", { name: "Brak zgody na lokalizację." });
  await expect(problem).toBeVisible();
  await expect(problem).toContainText("Uprawnienia → Lokalizacja → Zezwalaj");
  await expect(page.getByRole("status")).toContainText("Brak zgody na lokalizację. Na Androidzie");
  await expect(nearby).toHaveAttribute("aria-pressed", "false");
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("10 miejsc");
  await expect(list.getByRole("listitem").first()).toContainText("od Rynku");
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "home-nearby-denied.aria.yml" });
  await expectAccessible();
  await evidence("home-nearby-denied");

  // WHEN they allow it nowhere and press "Spróbuj ponownie" by keyboard
  const retry = problem.getByRole("button", { name: "Spróbuj ponownie" });
  await retry.focus();
  await page.keyboard.press("Enter");

  // THEN the browser is asked again, the explanation stays and focus stays on the retry button
  await expect.poll(() => page.evaluate(() => (window as unknown as { geolocationCalls: { count: number } }).geolocationCalls.count)).toBe(2);
  await expect(problem).toBeVisible();
  await expect(retry).toBeFocused();

  // WHEN they choose a district in the picker that opened with the explanation
  await expect(list.getByRole("button", { name: "Albo wybierz dzielnicę" })).toHaveAttribute("aria-expanded", "true");
  await list.getByLabel("Dzielnica").selectOption({ label: "Stare Miasto" });

  // THEN merely choosing in the list changes nothing yet
  await expect(nearby).toHaveAttribute("aria-pressed", "false");
  await expect(problem).toBeVisible();

  // WHEN they confirm with "Pokaż okolicę" by keyboard
  await list.getByRole("button", { name: "Pokaż okolicę" }).focus();
  await page.keyboard.press("Enter");

  // THEN the list is sorted from that point, the map marks it, focus lands on the toggle, and it is announced
  await expect(nearby).toHaveAttribute("aria-pressed", "true");
  await expect(nearby).toBeFocused();
  await expect(list.getByText("Od najbliższych, odległość od: Stare Miasto")).toBeVisible();
  await showResults(page);
  await expect(problem).toHaveCount(0);
  const rows = list.getByRole("listitem");
  await expect(rows.first()).toContainText("od wybranego punktu");
  await expect(page.locator("[data-you]")).toHaveText("Stare Miasto");
  await expect(page.getByRole("status").filter({ hasText: "W okolicy: Stare Miasto, od najbliższych. Znaleziono" })).toBeAttached();
  await expectAccessible();
  await evidence("home-nearby-district");

  // WHEN they turn it off
  await nearby.focus();
  await page.keyboard.press("Enter");
  await expect(nearby).toHaveAttribute("aria-pressed", "false");
  await showResults(page);

  // THEN distances are from Rynek again
  await expect(rows.first()).toContainText("od Rynku");
});

test("a district can be picked by keyboard without ever sharing the location", async ({ page, expectAccessible }) => {
  // GIVEN the home screen and a browser that counts location requests
  await page.goto("/");
  await page.evaluate(() => {
    const calls = { count: 0 };
    Object.assign(window, { geolocationCalls: calls });
    navigator.geolocation.getCurrentPosition = () => {
      calls.count += 1;
    };
  });
  const list = page.getByRole("region", { name: "Lista miejsc" });
  const nearby = list.getByRole("button", { name: "W mojej okolicy" });
  const manual = list.getByRole("button", { name: "Albo wybierz dzielnicę" });
  await expect(manual).toHaveAttribute("aria-expanded", "false");
  await expect(list.getByLabel("Dzielnica")).toBeHidden();

  // WHEN a keyboard user opens the picker, chooses Podgórze and confirms
  await manual.focus();
  await page.keyboard.press("Enter");
  await expect(manual).toHaveAttribute("aria-expanded", "true");
  await list.getByLabel("Dzielnica").selectOption({ label: "Podgórze" });
  await expect(nearby).toHaveAttribute("aria-pressed", "false");
  await list.getByRole("button", { name: "Pokaż okolicę" }).focus();
  await page.keyboard.press("Enter");

  // THEN the list sorts from Podgórze, the picker closes, focus is on the toggle, and the device was never asked
  await expect(nearby).toHaveAttribute("aria-pressed", "true");
  await expect(nearby).toBeFocused();
  await expect(list.getByText("Od najbliższych, odległość od: Podgórze")).toBeVisible();
  await expect(manual).toHaveAttribute("aria-expanded", "false");
  expect(await page.evaluate(() => (window as unknown as { geolocationCalls: { count: number } }).geolocationCalls.count)).toBe(0);
  await expectAccessible();
});
