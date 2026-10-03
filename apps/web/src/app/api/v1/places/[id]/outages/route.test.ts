import type { Outage } from "@krakow-bez-barier/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateResponse } from "@/server/http";
import { createMemoryOutagesStore } from "@/server/outages/memory-store";
import { jsonRequest } from "@/server/reports/testing";

const PLACE_ID = "6f1c9a52-8d3e-4b7a-9c1d-2e5f8a7b3c40";
const seed = () => createMemoryOutagesStore({ places: [{ id: PLACE_ID, externalRef: "osm:way/123" }] });

let memory = seed();
vi.mock("@/server/outages/drizzle-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/outages/drizzle-store")>()),
  outagesStore: () => memory.store,
}));

const { POST: report } = await import("./route");
const { POST: vote } = await import("./[outageId]/votes/route");

let client = 0;
const nextIp = () => `198.51.100.${++client}`;

const reportOutage = (body: unknown, ip = nextIp(), placeId = PLACE_ID) =>
  report(jsonRequest(`http://localhost/api/v1/places/${placeId}/outages`, body, { "x-forwarded-for": ip }), {
    params: Promise.resolve({ id: placeId }),
  });

const voteOn = (outageId: string, body: unknown, ip = nextIp()) =>
  vote(jsonRequest(`http://localhost/api/v1/places/${PLACE_ID}/outages/${outageId}/votes`, body, { "x-forwarded-for": ip }), {
    params: Promise.resolve({ id: PLACE_ID, outageId }),
  });

beforeEach(() => {
  memory = seed();
});

describe("POST /api/v1/places/{id}/outages", () => {
  it("lists a reported lift outage at once, and counts a second report as a confirmation", async () => {
    // GIVEN a place without outages
    // WHEN a visitor reports its lift broken (by its OSM reference)
    const first = await reportOutage({ equipment: "lift" }, "203.0.113.1", "osm:way/123");

    // THEN a spec-valid, unverified outage is opened
    expect(first.status).toBe(201);
    const opened: Outage = await first.json();
    expect(validateResponse("reportOutage", 201, opened)).toEqual([]);
    expect(opened).toMatchObject({ equipment: "lift", state: "reported", confirmations: 0, workingVotes: 0 });

    // WHEN two more visitors report the same lift
    const second = await reportOutage({ equipment: "lift" });
    const third = await reportOutage({ equipment: "lift" });

    // THEN they confirm the same outage, which becomes confirmed by the community
    expect(second.status).toBe(200);
    const confirmed: Outage = await third.json();
    expect(validateResponse("reportOutage", 200, confirmed)).toEqual([]);
    expect(confirmed).toMatchObject({ id: opened.id, state: "confirmed", confirmations: 2 });
    expect(memory.outages).toHaveLength(1);
  });

  it("doesn't let the reporter confirm their own outage", async () => {
    // GIVEN a visitor who reported the lift
    const first = await reportOutage({ equipment: "lift" }, "203.0.113.7");
    const { id } = await first.json();

    // WHEN the same visitor reports it again and presses "Potwierdzam awarię"
    const again = await reportOutage({ equipment: "lift" }, "203.0.113.7");
    const confirm = await voteOn(id, { vote: "still_broken" }, "203.0.113.7");

    // THEN neither counts, and both say so instead of answering as if a confirmation was saved
    expect([again.status, confirm.status]).toEqual([429, 429]);
    expect(again.headers.get("retry-after")).toBeTruthy();
    expect(memory.votes).toHaveLength(0);
  });

  it("refuses unknown places, equipment that can't break down and bots", async () => {
    // GIVEN the API
    // WHEN reporting for a missing place, a door and with the honeypot filled
    const missing = await reportOutage({ equipment: "lift" }, nextIp(), "nie-ma-takiego");
    const door = await reportOutage({ equipment: "door_width_cm" });
    const bot = await reportOutage({ equipment: "lift", website: "http://spam.example" });

    // THEN they are answered 404, 400 and 422, and nothing is stored
    expect([missing.status, door.status, bot.status]).toEqual([404, 400, 422]);
    expect(memory.outages).toHaveLength(0);
  });
});

describe("POST /api/v1/places/{id}/outages/{outageId}/votes", () => {
  it("takes the outage off the card when someone says it works", async () => {
    // GIVEN a reported lift outage
    const { id } = await (await reportOutage({ equipment: "lift" })).json();

    // WHEN another visitor answers "Działa"
    const working = await voteOn(id, { vote: "working" });

    // THEN the outage is resolved, and later votes on it are refused as no longer current
    expect(working.status).toBe(200);
    const body: Outage = await working.json();
    expect(validateResponse("voteOutage", 200, body)).toEqual([]);
    expect(body).toMatchObject({ state: "resolved", workingVotes: 1 });
    const late = await voteOn(id, { vote: "still_broken" });
    expect(late.status).toBe(409);
  });

  it("counts one vote of each kind per outage per client and answers 404 for an unknown outage", async () => {
    // GIVEN a reported ramp outage
    const { id } = await (await reportOutage({ equipment: "ramp" })).json();

    // WHEN one visitor confirms it twice, and someone votes on an outage that doesn't exist
    const first = await voteOn(id, { vote: "still_broken" }, "203.0.113.20");
    const repeat = await voteOn(id, { vote: "still_broken" }, "203.0.113.20");
    const unknown = await voteOn("00000000-0000-4000-8000-000000000000", { vote: "working" });

    // THEN only the first counts
    expect([first.status, repeat.status, unknown.status]).toEqual([200, 429, 404]);
    expect(repeat.headers.get("retry-after")).toBeTruthy();
    expect(await first.json()).toMatchObject({ confirmations: 1, state: "reported" });
  });
});
