import type { ModerationOutage } from "@krakow-bez-barier/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateResponse } from "@/server/http";
import { reportOutage, voteOutage } from "@/server/outages";
import { createMemoryOutagesStore } from "@/server/outages/memory-store";
import { createFakePlaceRepository, factRecord, placeRecord } from "@/server/places/fake-repository";
import { getPlace } from "@/server/places/service";
import { DEMO_MODERATOR_NAME, DEMO_REVERT_MINUTES } from "@/server/reports";

const hotel = placeRecord({ name: "Hotel Przykład" });
const museum = placeRecord({ name: "Muzeum Archeologiczne" });
const lift = factRecord(hotel, "lift", { kind: "boolean", boolean: true });

const seed = () =>
  createMemoryOutagesStore({
    places: [
      { id: hotel.id, name: hotel.name },
      { id: museum.id, name: museum.name },
    ],
  });

let memory = seed();
vi.mock("@/server/outages/drizzle-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/outages/drizzle-store")>()),
  outagesStore: () => memory.store,
}));

const { GET } = await import("./route");
const { DELETE } = await import("./[outageId]/route");

const url = "http://localhost/api/v1/moderation/outages";
const ANNA = "anna-token-0123456789";
const DEMO = "konto-demo-token-0123456789";
let client = 0;
const auth = (token = ANNA) => ({ authorization: `Bearer ${token}`, "x-forwarded-for": `198.51.100.${++client}` });

const list = (headers: Record<string, string> = auth()) => GET(new Request(url, { headers }));
const remove = (outageId: string, headers: Record<string, string> = auth()) =>
  DELETE(new Request(`${url}/${outageId}`, { method: "DELETE", headers }), { params: Promise.resolve({ outageId }) });

/** The hotel's card under the wheelchair profile, read through the same store the routes use. */
async function card(now = new Date()) {
  const fake = createFakePlaceRepository([hotel, museum], [lift]);
  const repository = { ...fake, recentOutages: memory.store.listRecent };
  return (await getPlace(hotel.id, { profile: "wheelchair" }, { repository, now }))!;
}

beforeEach(() => {
  memory = seed();
  vi.stubEnv("MODERATOR_TOKENS", `anna:${ANNA}`);
  vi.stubEnv("MODERATOR_DEMO_TOKEN", DEMO);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/v1/moderation/outages", () => {
  it("lists every active outage, newest first, with its place, and leaves out resolved ones", async () => {
    // GIVEN a confirmed hotel lift outage, a newer museum ramp outage and a museum lift outage marked working
    const hour = 3_600_000;
    const { outage: hotelLift } = await reportOutage(memory.store, hotel.id, { equipment: "lift" }, { now: new Date(Date.now() - 2 * hour) });
    await voteOutage(memory.store, hotel.id, hotelLift.id, { vote: "still_broken" });
    await voteOutage(memory.store, hotel.id, hotelLift.id, { vote: "still_broken" });
    const { outage: museumRamp } = await reportOutage(memory.store, museum.id, { equipment: "ramp" }, { now: new Date(Date.now() - hour) });
    const { outage: fixed } = await reportOutage(memory.store, museum.id, { equipment: "lift" });
    await voteOutage(memory.store, museum.id, fixed.id, { vote: "working" });

    // WHEN a moderator reads the list
    const res = await list();

    // THEN it is spec-valid and shows place, equipment, state and votes of the two active outages
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(validateResponse("listModerationOutages", 200, body)).toEqual([]);
    expect(body.moderator).toEqual({ name: "anna", demo: false, revertsAfterMinutes: null });
    expect(body.items).toEqual([
      expect.objectContaining({ id: museumRamp.id, placeId: museum.id, placeName: "Muzeum Archeologiczne", equipment: "ramp", state: "reported" }),
      expect.objectContaining({ id: hotelLift.id, placeName: "Hotel Przykład", state: "confirmed", confirmations: 2, workingVotes: 0 }),
    ]);
  });

  it("answers 401 without a moderator token", async () => {
    // WHEN the list is read anonymously
    const res = await list({ "x-forwarded-for": `198.51.100.${++client}` });

    // THEN 401
    expect(res.status).toBe(401);
    expect(validateResponse("listModerationOutages", 401, await res.json())).toEqual([]);
  });
});

describe("DELETE /api/v1/moderation/outages/{outageId}", () => {
  it("takes the outage off the card and out of the verdict, and a second removal is a 409", async () => {
    // GIVEN a reported hotel lift outage that makes the lift a barrier
    const { outage } = await reportOutage(memory.store, hotel.id, { equipment: "lift" });
    expect((await card()).verdict?.needs?.find((n) => n.need === "lift")).toMatchObject({ state: "barrier", outage: true });

    // WHEN a moderator removes it
    const res = await remove(outage.id);

    // THEN the answer is the spec-valid outage, now removed
    expect(res.status).toBe(200);
    const removed: ModerationOutage = await res.json();
    expect(validateResponse("removeModerationOutage", 200, removed)).toEqual([]);
    expect(removed).toMatchObject({ id: outage.id, state: "removed", placeName: "Hotel Przykład" });

    // AND the card and the moderator's list no longer show it, and the lift is not a barrier any more
    const after = await card();
    expect(after.outages).toEqual([]);
    expect(after.verdict?.needs?.find((n) => n.need === "lift")).toMatchObject({ state: "met" });
    expect((await (await list()).json()).items).toEqual([]);

    // AND it is kept with who removed it, not deleted
    expect(memory.outages[0]).toMatchObject({ removedBy: "anna", removalEndsAt: null });

    // AND votes on it and a second removal are refused as no longer active
    await expect(voteOutage(memory.store, hotel.id, outage.id, { vote: "still_broken" })).rejects.toMatchObject({ problem: { status: 409 } });
    const again = await remove(outage.id);
    expect(again.status).toBe(409);
    expect(validateResponse("removeModerationOutage", 409, await again.json())).toEqual([]);
  });

  it("answers 401 without a token and 404 for an unknown outage", async () => {
    // GIVEN an active outage
    const { outage } = await reportOutage(memory.store, hotel.id, { equipment: "ramp" });

    // WHEN it is removed anonymously, and an unknown one by a moderator
    const anonymous = await remove(outage.id, { "x-forwarded-for": `198.51.100.${++client}` });
    const unknown = await remove("nope");

    // THEN 401 leaves the outage listed, and the unknown one is 404
    expect(anonymous.status).toBe(401);
    expect((await card()).outages).toHaveLength(1);
    expect(unknown.status).toBe(404);
  });

  it("lets the demo account's removal lapse after the revert time", async () => {
    // GIVEN a hotel lift outage
    const { outage } = await reportOutage(memory.store, hotel.id, { equipment: "lift" });

    // WHEN the demo account removes it
    const res = await remove(outage.id, auth(DEMO));

    // THEN it is off the card at once, recorded under the demo account's name
    expect(res.status).toBe(200);
    expect((await card()).outages).toEqual([]);
    expect(memory.outages[0].removedBy).toBe(DEMO_MODERATOR_NAME);

    // AND after the revert time the outage counts again
    const later = new Date(Date.now() + (DEMO_REVERT_MINUTES + 1) * 60_000);
    expect((await card(later)).outages).toEqual([expect.objectContaining({ id: outage.id, state: "reported" })]);
  });
});
