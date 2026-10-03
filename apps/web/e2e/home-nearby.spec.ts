import { expect, test } from "./fixtures";

const WAWEL = { latitude: 50.0541, longitude: 19.9354, accuracy: 20 };

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
    await page.goto("/");
    const list = page.getByRole("region", { name: "Lista miejsc" });
    await expect(list.getByRole("heading", { level: 2 })).toHaveText("9 miejsc");
    const nearby = list.getByRole("button", { name: "W mojej okolicy" });
    await expect(nearby).toHaveAttribute("aria-pressed", "false");
    await expect(nearby).toHaveAccessibleDescription(/Dokładna pozycja zostaje na urządzeniu/);

    // WHEN a keyboard user turns on "W mojej okolicy"
    await nearby.focus();
    await page.keyboard.press("Enter");

    // THEN the list is sorted nearest first with distances from the user, announced, the map shows "Ty"
    await expect(nearby).toHaveAttribute("aria-pressed", "true");
    await expect(nearby).toBeFocused();
    const rows = list.getByRole("listitem");
    await expect(rows.first()).toContainText("od Ciebie");
    await expect(list).not.toContainText("od Rynku");
    const distances = (await rows.allInnerTexts()).map(metres);
    expect(distances).toEqual(distances.toSorted((a, b) => a - b));
    await expect(page.getByRole("status").filter({ hasText: "W Twojej okolicy, od najbliższych. Znaleziono 9 miejsc" })).toBeAttached();
    await expect(page.locator("[data-you]")).toHaveCount(1);
    await expect(page.locator("main")).toMatchAriaSnapshot({ name: "home-nearby.aria.yml" });
    await expectAccessible();
    await evidence("home-nearby");

    // WHEN they turn it off again
    await page.keyboard.press("Enter");

    // THEN the list is back to distances from Rynek and "Ty" is gone
    await expect(nearby).toHaveAttribute("aria-pressed", "false");
    await expect(rows.first()).toContainText("od Rynku");
    await expect(page.locator("[data-you]")).toHaveCount(0);
  });
});

test("'W mojej okolicy' on the list explains a refusal and the list keeps working", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN a browser that refuses location access
  await page.goto("/");
  await page.evaluate(() => {
    navigator.geolocation.getCurrentPosition = (_ok, fail) =>
      fail?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
  });
  const list = page.getByRole("region", { name: "Lista miejsc" });

  // WHEN the user turns on "W mojej okolicy"
  await list.getByRole("button", { name: "W mojej okolicy" }).click();

  // THEN they learn why, it is announced, and the list still shows distances from Rynek
  const denied = "Brak zgody na lokalizację. Możesz ją włączyć w ustawieniach urządzenia.";
  await expect(list.getByText(denied)).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(denied);
  await expect(list.getByRole("button", { name: "W mojej okolicy" })).toHaveAttribute("aria-pressed", "false");
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("9 miejsc");
  await expect(list.getByRole("listitem").first()).toContainText("od Rynku");
  await expectAccessible();
  await evidence("home-nearby-denied");
});
