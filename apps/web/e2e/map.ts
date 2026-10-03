import type { Page } from "@playwright/test";
import { expect } from "./fixtures";

export const pins = (page: Page) => page.locator("[data-place-id]");
export const clusters = (page: Page) => page.locator("[data-cluster-count]");

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

/** Waits until the map stops moving: the same markers at the same screen spots in two samples in a row. */
export async function markersSettled(page: Page) {
  const signature = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".maplibregl-marker")]
        .map((el) => `${el.dataset.placeId ?? `c${el.dataset.clusterCount}`}@${el.style.transform}`)
        .join("|"),
    );
  let last = "";
  await expect
    .poll(async () => last === (last = await signature()) && last !== "", { message: "map keeps moving", intervals: [200] })
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
