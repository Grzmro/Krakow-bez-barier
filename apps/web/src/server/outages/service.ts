import { outageRules, type Outage, type OutageCreate, type OutageVoteCreate } from "@krakow-bez-barier/contracts";
import { activeOutages, isActiveOutage, outageState, toOutage, type OutageRecord } from "@/domain/outages";
import { HttpError } from "@/server/http";
import type { OutagesStore } from "./store";

const isActive = (now: Date) => (record: OutageRecord) => isActiveOutage({ state: outageState(record, now) });

async function requirePlace(store: OutagesStore, ref: string) {
  const place = await store.findPlace(ref);
  if (!place) throw new HttpError(404, { detail: `Place "${ref}" does not exist.` });
  return place;
}

/**
 * Reports an outage of a place's equipment. When one of this equipment is still active the report confirms it
 * instead (`created: false`), unless `mayConfirm` says this client already did.
 */
export async function reportOutage(
  store: OutagesStore,
  placeRef: string,
  body: OutageCreate,
  options: { now?: Date; mayConfirm?: (outageId: string) => boolean } = {},
): Promise<{ outage: Outage; created: boolean; confirmed: boolean }> {
  const { now = new Date(), mayConfirm = () => true } = options;
  if (body.website) {
    throw new HttpError(422, {
      detail: "The report could not be accepted.",
      errors: [{ field: "website", message: "must be empty" }],
    });
  }
  const place = await requirePlace(store, placeRef);
  const { record, created, confirmed } = await store.report({
    placeId: place.id,
    equipment: body.equipment,
    at: now,
    isActive: isActive(now),
    mayConfirm,
  });
  return { outage: toOutage(record, now), created, confirmed };
}

/** "Potwierdzam awarię" (`still_broken`) or "Działa" (`working`) on an active outage; `409` once it is not active. */
export async function voteOutage(
  store: OutagesStore,
  placeRef: string,
  outageId: string,
  body: OutageVoteCreate,
  now: Date = new Date(),
): Promise<Outage> {
  const place = await requirePlace(store, placeRef);
  const result = await store.vote({ placeId: place.id, outageId, vote: body.vote, at: now, isActive: isActive(now) });
  if (result.kind === "not_found") throw new HttpError(404, { detail: `Place "${placeRef}" has no outage "${outageId}".` });
  if (result.kind === "inactive") {
    throw new HttpError(409, { detail: `Outage "${outageId}" is already ${outageState(result.record, now)}.` });
  }
  return toOutage(result.record, now);
}

/**
 * Active outages of each place, newest first — what the place card lists and verdicts count. `listRecent` is
 * `OutagesStore.listRecent` or `PlaceRepository.recentOutages`.
 */
export async function activeOutagesByPlace(
  listRecent: (placeIds: string[], since: Date) => Promise<OutageRecord[]>,
  placeIds: string[],
  now: Date,
): Promise<Map<string, Outage[]>> {
  const since = new Date(now.getTime() - outageRules.expiresAfterHours * 3_600_000);
  const records = await listRecent(placeIds, since);
  const byPlace = Map.groupBy(records, (r) => r.placeId);
  return new Map(placeIds.map((id) => [id, activeOutages(byPlace.get(id) ?? [], now)]));
}
