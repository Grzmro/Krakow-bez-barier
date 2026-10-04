import { beforeEach, describe, expect, it } from "vitest";
import { mockGetPlace } from "./mock-api";
import { resetMockContributions, withContributionMocks } from "./mock-contributions";

const BASE = "http://mock.local/api/v1";
const PLACE = "palac-krzysztofory";
const STEPS_FACT = "fact_osm_krzysztofory_steps";
const TOKEN = "device-a-0123456789abcdef";

const unreachable = async (): Promise<Response> => {
  throw new Error("fallback must not be called");
};
const fetch = withContributionMocks(unreachable, (id) => mockGetPlace(id));

const send = (method: string, path: string, body?: unknown, token = TOKEN) =>
  fetch(
    new Request(`${BASE}${path}`, {
      method,
      headers: { "content-type": "application/json", "x-contributor-token": token },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    }),
  );

const report = (number: number, token?: string) =>
  send("POST", "/reports", { placeId: PLACE, attribute: "step_count", value: { kind: "number", number, unit: "count" } }, token);

const mine = async (token = TOKEN) => (await (await send("GET", `/places/${PLACE}/contributions`, undefined, token)).json()).items;

describe("withContributionMocks", () => {
  beforeEach(() => resetMockContributions());

  it("keeps one report per device and attribute: the second one replaces the first", async () => {
    // GIVEN a report of the step count from one device
    const first = await report(2);

    // WHEN the same device reports the step count again
    const second = await report(3);

    // THEN the second answer is 200 with the same id, dated now, and the device has one contribution with the new value
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    const [a, b] = [await first.json(), await second.json()];
    expect(b.id).toBe(a.id);
    const items = await mine();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "report", attribute: "step_count", value: { number: 3 } });
  });

  it("replaces the device's report with its confirmation, and keeps other devices apart", async () => {
    // GIVEN a report from this device and one from another device
    await report(2);
    await report(4, "device-b-0123456789abcdef");

    // WHEN this device confirms the current step fact
    const confirmed = await send("POST", `/places/${PLACE}/confirmations`, { factId: STEPS_FACT });

    // THEN this device has only the confirmation, the other device still its report
    expect(confirmed.status).toBe(201);
    expect(await mine()).toEqual([expect.objectContaining({ kind: "confirmation", factId: STEPS_FACT })]);
    expect(await mine("device-b-0123456789abcdef")).toEqual([expect.objectContaining({ kind: "report" })]);
  });

  it("withdraws the device's contribution of one attribute", async () => {
    // GIVEN a pending report
    await report(2);

    // WHEN the device withdraws the step count
    const response = await send("DELETE", `/places/${PLACE}/contributions/step_count`);

    // THEN nothing is pending for the device
    expect(response.status).toBe(204);
    expect(await mine()).toEqual([]);
  });

  it("answers 404 for a place that doesn't exist", async () => {
    // WHEN listing contributions of an unknown place
    const response = await send("GET", "/places/nie-ma/contributions");

    // THEN it is a 404 problem
    expect(response.status).toBe(404);
  });
});
