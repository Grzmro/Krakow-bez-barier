import type { Outage, OutageCreate, OutageEquipment, OutageVote, OutageVoteCreate, Problem } from "@krakow-bez-barier/contracts";
import { activeOutages, isActiveOutage, outageState, toOutage, type OutageRecord } from "@/domain/outages";

// In-browser stand-in for outage reports in the example-data mode (tests, demo recording): outages live in memory for
// the page's lifetime and use the same domain rules as the API, so the card and the verdicts behave the same.

type Stored = { id: string; placeId: string; equipment: OutageEquipment; reportedAt: Date; votes: { vote: OutageVote; at: Date }[] };

let outages: Stored[] = [];
let seq = 0;

function record(outage: Stored): OutageRecord {
  const confirmations = outage.votes.filter((v) => v.vote === "still_broken");
  return {
    id: outage.id,
    placeId: outage.placeId,
    equipment: outage.equipment,
    reportedAt: outage.reportedAt,
    confirmations: confirmations.length,
    workingVotes: outage.votes.length - confirmations.length,
    lastConfirmedAt: new Date(Math.max(outage.reportedAt.getTime(), ...confirmations.map((v) => v.at.getTime()))),
  };
}

/** Active outages of a place, as `Place.outages` lists them. */
export function mockOutagesOf(placeId: string, now: Date = new Date()): Outage[] {
  return activeOutages(outages.filter((o) => o.placeId === placeId).map(record), now);
}

/** Forgets every outage (tests). */
export function resetMockOutages() {
  outages = [];
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": status < 400 ? "application/json" : "application/problem+json" },
  });

const problem = (status: number, title: string, detail: string) =>
  json({ type: "about:blank", title, status, detail } satisfies Problem, status);

type Fetch = (input: Request) => Promise<Response>;

/** Answers `POST /places/{id}/outages` and `POST /places/{id}/outages/{outageId}/votes`; `placeExists` checks the id. */
export function withOutageMocks(fallback: Fetch, placeExists: (id: string) => boolean): Fetch {
  return async (input) => {
    const path = new URL(input.url, "http://mock.local").pathname.replace(/^.*\/api\/v1/, "");
    const report = path.match(/^\/places\/([^/]+)\/outages$/);
    const vote = path.match(/^\/places\/([^/]+)\/outages\/([^/]+)\/votes$/);
    if (input.method !== "POST" || !(report || vote)) return fallback(input);

    const placeId = decodeURIComponent((report ?? vote)![1]);
    if (!placeExists(placeId)) return problem(404, "Not found", `Place "${placeId}" does not exist.`);
    const now = new Date();
    const active = (o: Stored) => isActiveOutage({ state: outageState(record(o), now) });

    if (report) {
      const body = (await input.json()) as OutageCreate;
      const current = outages.find((o) => o.placeId === placeId && o.equipment === body.equipment && active(o));
      if (current) {
        current.votes.push({ vote: "still_broken", at: now });
        return json(toOutage(record(current), now), 200);
      }
      const created: Stored = { id: `out_mock_${++seq}`, placeId, equipment: body.equipment, reportedAt: now, votes: [] };
      outages.push(created);
      return json(toOutage(record(created), now), 201);
    }

    const outageId = decodeURIComponent(vote![2]);
    const outage = outages.find((o) => o.id === outageId && o.placeId === placeId);
    if (!outage) return problem(404, "Not found", `Place "${placeId}" has no outage "${outageId}".`);
    if (!active(outage)) return problem(409, "Conflict", `Outage "${outageId}" is no longer active.`);
    const body = (await input.json()) as OutageVoteCreate;
    outage.votes.push({ vote: body.vote, at: now });
    return json(toOutage(record(outage), now), 200);
  };
}
