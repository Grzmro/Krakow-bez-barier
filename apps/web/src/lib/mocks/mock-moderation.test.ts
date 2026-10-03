import { describe, expect, it } from "vitest";
import type { ModerationReport } from "@krakow-bez-barier/contracts";
import { MOCK_MODERATOR, withModerationMocks } from "./mock-moderation";

const QUEUE_URL = "http://mock.local/api/v1/moderation/reports";
const auth = { authorization: "Bearer any-token" };
const passThrough = async () => new Response("fallback", { status: 299 });

const queue = (): ModerationReport[] => [
  {
    id: "r1",
    placeId: "p1",
    placeName: "Podziemia Rynku",
    attribute: "lift",
    value: { kind: "boolean", boolean: false },
    currentValue: { kind: "boolean", boolean: true },
    comment: null,
    photoUrl: null,
    status: "new",
    createdAt: "2026-10-03T09:00:00Z",
    decidedAt: null,
    history: [],
  },
];

const decide = (fetch: ReturnType<typeof withModerationMocks>, decision: string) =>
  fetch(
    new Request(QUEUE_URL, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ reportId: "r1", decision, note: " Sprawdzone " }),
    }),
  );

describe("withModerationMocks", () => {
  it("asks for a token like the real API", async () => {
    // GIVEN the mock queue
    const fetch = withModerationMocks(passThrough, queue());

    // WHEN listing without a bearer token
    const response = await fetch(new Request(QUEUE_URL));

    // THEN it answers 401
    expect(response.status).toBe(401);
  });

  it("issues a demo-account session that signs in as the demo account", async () => {
    // GIVEN the mock queue
    const fetch = withModerationMocks(passThrough, queue());

    // WHEN the one-click demo session is taken and used to read the queue
    const created = await fetch(new Request("http://mock.local/api/v1/moderation/demo-session", { method: "POST" }));
    const { token } = await created.json();
    const list = await (await fetch(new Request(QUEUE_URL, { headers: { authorization: `Bearer ${token}` } }))).json();

    // THEN the queue is read as the demo account
    expect(created.status).toBe(201);
    expect(list.moderator).toMatchObject({ demo: true, revertsAfterMinutes: 30 });
  });

  it("records a decision in the report's status and history", async () => {
    // GIVEN the mock queue with one new report
    const fetch = withModerationMocks(passThrough, queue());

    // WHEN the report is accepted
    const decided = await decide(fetch, "accepted");

    // THEN the plain report comes back accepted and the queue lists it with the decision in its history
    expect(decided.status).toBe(200);
    expect(await decided.json()).toMatchObject({ id: "r1", status: "accepted" });
    const list = await (await fetch(new Request(QUEUE_URL, { headers: auth }))).json();
    expect(list.items[0].status).toBe("accepted");
    expect(list.items[0].history).toEqual([
      expect.objectContaining({ decision: "accepted", note: "Sprawdzone", moderator: MOCK_MODERATOR }),
    ]);
    const open = await (await fetch(new Request(`${QUEUE_URL}?status=new`, { headers: auth }))).json();
    expect(open.items).toEqual([]);
  });

  it("refuses a second decision on a final report with 409", async () => {
    // GIVEN a rejected report
    const fetch = withModerationMocks(passThrough, queue());
    await decide(fetch, "rejected");

    // WHEN a moderator tries to accept it
    const response = await decide(fetch, "accepted");

    // THEN it is a conflict
    expect(response.status).toBe(409);
  });

  it("lists the example outages and removes one, then answers 404 for it", async () => {
    // GIVEN the mock with the spec's example outages
    const fetch = withModerationMocks(passThrough, queue());
    const OUTAGES_URL = "http://mock.local/api/v1/moderation/outages";
    const [first, second] = (await (await fetch(new Request(OUTAGES_URL, { headers: auth }))).json()).items;

    // WHEN a moderator removes the first, twice
    const removed = await fetch(new Request(`${OUTAGES_URL}/${first.id}`, { method: "DELETE", headers: auth }));
    const again = await fetch(new Request(`${OUTAGES_URL}/${first.id}`, { method: "DELETE", headers: auth }));

    // THEN it comes back removed, leaves the list, and the second removal is a 404
    expect(await removed.json()).toMatchObject({ id: first.id, state: "removed" });
    expect((await (await fetch(new Request(OUTAGES_URL, { headers: auth }))).json()).items).toEqual([second]);
    expect(again.status).toBe(404);
    expect((await fetch(new Request(OUTAGES_URL))).status).toBe(401);
  });

  it("passes other paths to the fallback", async () => {
    // GIVEN the mock queue
    const fetch = withModerationMocks(passThrough, queue());

    // WHEN requesting something outside moderation
    const response = await fetch(new Request("http://mock.local/api/v1/sources"));

    // THEN the fallback answers
    expect(response.status).toBe(299);
  });
});
