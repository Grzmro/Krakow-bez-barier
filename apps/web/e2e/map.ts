import type { Page } from "@playwright/test";
import { expect } from "./fixtures";

export const pins = (page: Page) => page.locator("[data-place-id]");
export const clusters = (page: Page) => page.locator("[data-cluster-count]");

/**
 * Opens the home screen with all ten sample places listed and pinned. The start state shows none, so this
 * searches for "r", which every sample place's name or street contains.
 */
export async function gotoAllPlaces(page: Page) {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Wyszukaj miejsce" }).fill("r");
}

/** Places the map shows: single pins plus the places counted inside clusters. */
export async function placesOnMap(page: Page) {
  const inClusters = await clusters(page).evaluateAll((els) =>
    els.reduce((sum, el) => sum + Number((el as HTMLElement).dataset.clusterCount), 0),
  );
  return (await pins(page).count()) + inClusters;
}

/** Verdicts the map shows, as `{ status: count }`: each pin's plus each cluster's breakdown. */
export async function verdictsOnMap(page: Page) {
  return page.evaluate(() => {
    const tally: Record<string, number> = {};
    for (const pin of document.querySelectorAll<HTMLElement>("[data-place-id][data-status]")) {
      tally[pin.dataset.status!] = (tally[pin.dataset.status!] ?? 0) + 1;
    }
    for (const cluster of document.querySelectorAll<HTMLElement>("[data-cluster-count]")) {
      for (const part of cluster.dataset.verdicts?.split(" ").filter(Boolean) ?? []) {
        const [status, n] = part.split(":");
        tally[status] = (tally[status] ?? 0) + Number(n);
      }
    }
    return tally;
  });
}

/**
 * Waits until the map stands still: the camera is not moving (`data-moving`, set from MapLibre's movestart/moveend)
 * and the markers sit at the same screen spots over two rendered frames (a sheet or layout transition moves them
 * without moving the camera). Checked inside the page, frame by frame: under load a single CDP round trip can take
 * seconds, so sampling from the test would see a frozen map as moving, or a moving one as still.
 */
export async function markersSettled(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
          const spots = () =>
            [...document.querySelectorAll<HTMLElement>(".maplibregl-marker")]
              .map((el) => {
                const r = el.getBoundingClientRect();
                return `${el.dataset.placeId ?? `c${el.dataset.clusterCount}`}@${r.x},${r.y}`;
              })
              .join("|");
          // Input already dispatched (a touch, a click) is turned into camera moves in MapLibre's next frame.
          await frame();
          if (document.querySelector<HTMLElement>(".maplibregl-map")?.dataset.moving !== "false") return false;
          const before = spots();
          await frame();
          await frame();
          return before !== "" && before === spots() && document.querySelector<HTMLElement>(".maplibregl-map")?.dataset.moving === "false";
        }),
      // An ease ends with the first frame after its 300–400 ms; a software-GL frame on a loaded machine can take a second.
      { message: "map keeps moving", intervals: [100], timeout: 10_000 },
    )
    .toBe(true);
}

/**
 * Zooms in on the biggest cluster (as a click on it would) until the markers near the view are all
 * single pins; the last cluster's places, at least two, are then pins in view.
 */
export async function expandClusters(page: Page) {
  for (let i = 0; i < 12; i++) {
    await markersSettled(page);
    const counts = await clusters(page).evaluateAll((els) => els.map((el) => Number((el as HTMLElement).dataset.clusterCount)));
    if (counts.length === 0) return;
    // A cluster may sit under the search bar or chips; the tap itself is what map-clusters.spec tests.
    await clusters(page).nth(counts.indexOf(Math.max(...counts))).dispatchEvent("click");
  }
  await expect(clusters(page)).toHaveCount(0);
}
