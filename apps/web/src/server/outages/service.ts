import {
  outageRules,
  type ModerationOutage,
  type Outage,
  type OutageCreate,
  type OutageVoteCreate,
} from "@krakow-bez-barier/contracts";
import { activeOutages, isActiveOutage, outageState, toOutage, type OutageRecord } from "@/domain/outages";
import { HttpError } from "@/server/http";
import { DEMO_REVERT_MINUTES } from "@/server/reports/demo";
import type { ModeratorPrincipal } from "@/server/reports/moderator-auth";
import type { OutagesStore, PlacedOutageRecord } from "./store";

const sinceExpiry = (now: Date) => new Date(now.getTime() - outageRules.expiresAfterHours * 3_600_000);
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
  const records = await listRecent(placeIds, sinceExpiry(now));
  const byPlace = Map.groupBy(records, (r) => r.placeId);
  return new Map(placeIds.map((id) => [id, activeOutages(byPlace.get(id) ?? [], now)]));
}

const toModerationOutage = (record: PlacedOutageRecord, now: Date): ModerationOutage => ({
  ...toOutage(record, now),
  placeId: record.placeId,
  placeName: record.placeName,
});

/** Every active outage of every place, newest first, with its place — the moderator's "Awarie" list. */
export async function listModerationOutages(store: OutagesStore, now: Date = new Date()): Promise<ModerationOutage[]> {
  const records = await store.listRecentEverywhere(sinceExpiry(now));
  return records
    .map((record) => toModerationOutage(record, now))
    .filter(isActiveOutage)
    .sort((a, b) => Date.parse(b.reportedAt) - Date.parse(a.reportedAt) || (a.id < b.id ? -1 : 1));
}

/**
 * Takes an active outage down as false or spam: it leaves the card and the verdicts at once. The demo account's
 * removal ends after `DEMO_REVERT_MINUTES`, so the shared data is never changed for good. `409` once not active.
 */
export async function removeOutage(
  store: OutagesStore,
  outageId: string,
  moderator: ModeratorPrincipal,
  now: Date = new Date(),
): Promise<ModerationOutage> {
  const endsAt = moderator.demo ? new Date(now.getTime() + DEMO_REVERT_MINUTES * 60_000) : null;
  const result = await store.remove({ outageId, moderator: moderator.name, at: now, endsAt, isActive: isActive(now) });
  if (result.kind === "not_found") throw new HttpError(404, { detail: `Outage "${outageId}" does not exist.` });
  if (result.kind === "inactive") {
    throw new HttpError(409, { detail: `Outage "${outageId}" is already ${outageState(result.record, now)}.` });
  }
  return toModerationOutage(result.record, now);
}
