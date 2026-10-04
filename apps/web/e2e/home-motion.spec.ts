import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { showResults } from "./map";

// Motion is read from computed styles, never timed: a test that waits for an animation to look a
// certain way mid-flight is a flaky test.

const animation = (row: Locator) => row.evaluate((el) => getComputedStyle(el).animationDuration);
const transition = (el: Locator) => el.evaluate((node) => getComputedStyle(node).transitionDuration.split(",")[0]);

async function restaurantsForWheelchair(page: Page) {
  await page.goto("/");
  const list = page.getByRole("region", { name: "Lista miejsc" });
  await page.getByRole("button", { name: "Restauracje" }).click();
  await showResults(page);
  await list.getByRole("radio", { name: "Wózek", exact: true }).click();
  const rows = list.locator("#lista > ul > li");
  await expect(rows.first()).toBeVisible();
  // Its name changes once open ("Ukryj…"), so it is held by the region it controls.
  const id = await list.getByRole("button", { name: /^Dlaczego Restauracja Przykład/ }).getAttribute("aria-controls");
  return { rows, why: list.locator(`button[aria-controls="${id}"]`), details: list.locator(`[id="${id}"]`) };
}

test("list rows enter and the details fold open with motion; focus and state are unchanged", async ({ page }) => {
  // GIVEN restaurants listed for a wheelchair user, with the system's default motion
  const { rows, why, details } = await restaurantsForWheelchair(page);

  // THEN rows enter with the short list animation and the details are set to unfold smoothly
  expect(await animation(rows.first())).toBe("0.3s");
  expect(await transition(details)).toBe("0.2s");

  // WHEN the "Dlaczego?" button is pressed from the keyboard
  await why.focus();
  await page.keyboard.press("Enter");

  // THEN the details are open for assistive tech at once and focus stays on the button
  await expect(why).toHaveAttribute("aria-expanded", "true");
  await expect(details).toBeVisible();
  await expect(why).toBeFocused();
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("rows and details change instantly, and the screen still passes axe", async ({ page, expectAccessible, evidence }) => {
    // GIVEN a visitor whose system asks for reduced motion
    const { rows, why, details } = await restaurantsForWheelchair(page);

    // THEN nothing moves: the row animation and the unfolding are instant
    expect(await animation(rows.first())).toBe("0.001s");
    expect(await transition(details)).toBe("0.001s");

    // WHEN the details are opened
    await why.click();

    // THEN they are there straight away
    await expect(details).toBeVisible();
    await expectAccessible();
    await evidence("home-reduced-motion");
  });
});

test("'Mniej animacji' on the page (data-motion=reduce) turns motion off without the system setting", async ({ page }) => {
  // GIVEN the list with default system motion
  const { rows, details } = await restaurantsForWheelchair(page);
  expect(await animation(rows.first())).toBe("0.3s");

  // WHEN the visitor's own setting marks the page (KBB-92 writes this attribute)
  await page.evaluate(() => document.documentElement.setAttribute("data-motion", "reduce"));

  // THEN rows and details change instantly
  expect(await animation(rows.first())).toBe("0.001s");
  expect(await transition(details)).toBe("0.001s");
});
