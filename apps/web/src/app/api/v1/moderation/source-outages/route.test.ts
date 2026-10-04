import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateResponse } from "@/server/http";
import { createFakePlaceRepository, factRecord, placeRecord, sourceRecord } from "@/server/places/fake-repository";
import { getPlace } from "@/server/places/service";
import { DEMO_MODERATOR_NAME } from "@/server/reports";
import { createMemorySourceOutagesStore } from "@/server/source-outages/memory-store";
import { SIMULATION_MINUTES } from "@/server/source-outages";

const city = sourceRecord({ id: "msip", name: "MSIP", kind: "official_open_data", baseReliability: "confirmed" });
const palace = placeRecord({ name: "Pałac" });
const lift = factRecord(palace, "lift", { kind: "boolean", boolean: true }, { source: city, reliability: "confirmed" });

const seed = () =>
  createMemorySourceOutagesStore({
    sources: [
      { id: "msip", name: "MSIP", kind: "official_open_data" },
      { id: "community-moderated", name: "Zgłoszenia", kind: "user_report" },
    ],
  });

let memory = seed();
vi.mock("@/server/source-outages/drizzle-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/source-outages/drizzle-store")>()),
  sourceOutagesStore: () => memory.store,
}));

const { GET } = await import("./route");
const { PUT, DELETE } = await import("./[sourceId]/route");

const url = "http://localhost/api/v1/moderation/source-outages";
const ANNA = "anna-token-0123456789";
const DEMO = "konto-demo-token-0123456789";
let client = 0;
const auth = (token = ANNA) => ({ authorization: `Bearer ${token}`, "x-forwarded-for": `198.51.100.${++client}` });

const list = (headers: Record<string, string> = auth()) => GET(new Request(url, { headers }));
const start = (sourceId: string, headers: Record<string, string> = auth()) =>
  PUT(new Request(`${url}/${sourceId}`, { method: "PUT", headers }), { params: Promise.resolve({ sourceId }) });
const stop = (sourceId: string, headers: Record<string, string> = auth()) =>
  DELETE(new Request(`${url}/${sourceId}`, { method: "DELETE", headers }), { params: Promise.resolve({ sourceId }) });

/** The palace card, read like `GET /places/{id}` does: the running simulations come from the same store. */
async function card(now = new Date()) {
  return (await getPlace(palace.id, {}, { repository: createFakePlaceRepository([palace], [lift]), now }))!;
}

beforeEach(() => {
  memory = seed();
  vi.stubEnv("MODERATOR_TOKENS", `anna:${ANNA}`);
  vi.stubEnv("MODERATOR_DEMO_TOKEN", DEMO);
  vi.stubEnv("SIMULATE_SOURCE_OUTAGE", "");
  // The store is mocked; a configured database only makes the places service ask it.
  vi.stubEnv("DATABASE_URL", "postgres://test.invalid/kbb");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("PUT /api/v1/moderation/source-outages/{sourceId}", () => {
  it("switches on a simulated outage: the card shows the source failed and keeps its facts, marked stale", async () => {
    // GIVEN the demo account signed in
    // WHEN it switches on the outage of the city source
    const res = await start("msip", auth(DEMO));

    // THEN the switch is spec-valid, recorded under the demo account and ends by itself in 15 minutes
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(validateResponse("startSimulatedSourceOutage", 200, body)).toEqual([]);
    expect(body).toMatchObject({ sourceId: "msip", sourceName: "MSIP", startedBy: DEMO_MODERATOR_NAME, stoppedAt: null });
    expect(Date.parse(body.endsAt) - Date.parse(body.startedAt)).toBe(SIMULATION_MINUTES * 60_000);

    // AND the card reports the source in a (simulated) outage, the lift fact is still there but stale
    const place = await card();
    expect(place.sources).toEqual([expect.objectContaining({ id: "msip", refreshStatus: "outage", simulatedOutage: true })]);
    const liftAttribute = place.attributes.find((a) => a.attribute === "lift")!;
    expect(liftAttribute.facts).toHaveLength(1);
    expect(liftAttribute.facts[0].stale).toBe(true);
  });

  it("restarts the clock instead of opening a second simulation when switched on again", async () => {
    // GIVEN a simulation started 10 minutes ago
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T09:00:00Z"));
    await start("msip");
    vi.setSystemTime(new Date("2026-10-04T09:10:00Z"));

    // WHEN it is switched on again
    const body = await (await start("msip")).json();

    // THEN the same simulation runs on until 15 minutes from now
    expect(body).toMatchObject({ startedAt: "2026-10-04T09:00:00.000Z", endsAt: "2026-10-04T09:25:00.000Z" });
    expect(memory.simulations).toHaveLength(1);
  });

  it("answers 404 for an unknown source and for user reports, which are not fetched from anywhere", async () => {
    // GIVEN a signed-in moderator
    // WHEN they try a source that does not exist and the user-report source
    const unknown = await start("nope");
    const reports = await start("community-moderated");

    // THEN both are refused with a documented problem and nothing is recorded
    expect(unknown.status).toBe(404);
    expect(validateResponse("startSimulatedSourceOutage", 404, await unknown.json())).toEqual([]);
    expect(reports.status).toBe(404);
    expect(memory.simulations).toHaveLength(0);
  });

  it("refuses a request without a moderator token", async () => {
    // GIVEN no token at all, and a wrong one
    // WHEN they try to switch on an outage
    const missing = await start("msip", { "x-forwarded-for": "203.0.113.7" });
    const wrong = await start("msip", auth("not-a-moderator-token-123"));

    // THEN both answer 401 and nothing is recorded
    expect(missing.status).toBe(401);
    expect(validateResponse("startSimulatedSourceOutage", 401, await missing.json())).toEqual([]);
    expect(wrong.status).toBe(401);
    expect(memory.simulations).toHaveLength(0);
  });

  it("limits switches to 20 a minute per client", async () => {
    // GIVEN a client that has already switched 20 times this minute
    const headers = { authorization: `Bearer ${ANNA}`, "x-forwarded-for": "192.0.2.99" };
    for (let i = 0; i < 20; i++) expect((await start("msip", headers)).status).toBe(200);

    // WHEN it switches once more
    const res = await start("msip", headers);

    // THEN it is told to wait
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
  });
});

describe("expiry and DELETE", () => {
  it("ends by itself after 15 minutes: the card shows the source as before", async () => {
    // GIVEN an outage switched on at 9:00
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T09:00:00Z"));
    await start("msip");
    expect((await card()).sources[0].refreshStatus).toBe("outage");

    // WHEN it is 9:15
    vi.setSystemTime(new Date("2026-10-04T09:15:00Z"));

    // THEN nothing runs any more, the card is back to normal and the switch stays in the audit
    const body = await (await list()).json();
    expect(validateResponse("listSimulatedSourceOutages", 200, body)).toEqual([]);
    expect(body).toMatchObject({ items: [], durationMinutes: SIMULATION_MINUTES });
    const place = await card();
    expect(place.sources[0]).toMatchObject({ refreshStatus: "ok", simulatedOutage: false });
    expect(place.attributes.find((a) => a.attribute === "lift")!.facts[0].stale).toBe(false);
    expect(memory.simulations).toHaveLength(1);
  });

  it("switches off early, keeping who did it, and answers 404 when nothing runs", async () => {
    // GIVEN a running simulation
    await start("msip", auth(DEMO));

    // WHEN a moderator switches it off, and then again
    const res = await stop("msip");
    const again = await stop("msip");

    // THEN it is stopped and recorded, the list is empty, the second call finds nothing
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(validateResponse("stopSimulatedSourceOutage", 200, body)).toEqual([]);
    expect(body.stoppedAt).not.toBeNull();
    expect(memory.simulations[0]).toMatchObject({ startedBy: DEMO_MODERATOR_NAME, stoppedBy: "anna" });
    expect((await (await list()).json()).items).toEqual([]);
    expect(again.status).toBe(404);
    expect((await card()).sources[0].refreshStatus).toBe("ok");
  });

  it("lists running simulations only for a moderator", async () => {
    // GIVEN a running simulation
    await start("msip");

    // WHEN it is listed with and without a token
    const signedIn = await (await list()).json();
    const anonymous = await list({ "x-forwarded-for": "203.0.113.8" });

    // THEN the moderator sees it with their session; without a token it is 401
    expect(signedIn.items).toEqual([expect.objectContaining({ sourceId: "msip", startedBy: "anna" })]);
    expect(signedIn.moderator).toEqual({ name: "anna", demo: false, revertsAfterMinutes: null });
    expect(anonymous.status).toBe(401);
  });
});
