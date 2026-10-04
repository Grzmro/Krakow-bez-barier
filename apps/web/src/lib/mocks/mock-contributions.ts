import type {
  AccessibilityAttribute,
  Confirmation,
  ConfirmationCreate,
  Contribution,
  Place,
  Problem,
  Report,
  ReportCreate,
} from "@krakow-bez-barier/contracts";

// In-browser stand-in for reports and confirmations in the example-data mode (tests, demo recording). Like the API, it
// keeps one pending contribution per contributor token, place and attribute — the latest wins — for the page's lifetime.

type Stored = Contribution & { placeId: string; comment: string | null };

let stored = new Map<string, Stored>();
let seq = 0;

const keyOf = (token: string, placeId: string, attribute: AccessibilityAttribute) => `${token}|${placeId}|${attribute}`;

/** Forgets every contribution (tests). */
export function resetMockContributions() {
  stored = new Map();
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": status < 400 ? "application/json" : "application/problem+json" },
  });

const problem = (status: number, title: string, detail: string) =>
  json({ type: "about:blank", title, status, detail } satisfies Problem, status);

type Fetch = (input: Request) => Promise<Response>;

/**
 * Answers `POST /reports`, `POST /places/{id}/confirmations`, `GET /places/{id}/contributions` and
 * `DELETE /places/{id}/contributions/{attribute}`; `getPlace` looks up a place by id.
 */
export function withContributionMocks(fallback: Fetch, getPlace: (id: string) => Place | null): Fetch {
  return async (input) => {
    const path = new URL(input.url, "http://mock.local").pathname.replace(/^.*\/api\/v1/, "");
    const confirmation = path.match(/^\/places\/([^/]+)\/confirmations$/);
    const list = path.match(/^\/places\/([^/]+)\/contributions$/);
    const withdraw = path.match(/^\/places\/([^/]+)\/contributions\/([^/]+)$/);
    const isReport = input.method === "POST" && path === "/reports";
    if (
      !isReport &&
      !(input.method === "POST" && confirmation) &&
      !(input.method === "GET" && list) &&
      !(input.method === "DELETE" && withdraw)
    ) {
      return fallback(input);
    }

    const token = input.headers.get("x-contributor-token") ?? `anonymous-${++seq}`;
    const now = new Date().toISOString();

    if (isReport) {
      const body = (await input.json()) as ReportCreate;
      if (!getPlace(body.placeId)) return problem(404, "Not found", `Place "${body.placeId}" does not exist.`);
      const key = keyOf(token, body.placeId, body.attribute);
      const previous = stored.get(key);
      const id = previous?.kind === "report" ? previous.id : `rep_mock_${++seq}`;
      stored.set(key, {
        kind: "report",
        id,
        attribute: body.attribute,
        value: body.value,
        factId: null,
        createdAt: now,
        placeId: body.placeId,
        comment: body.comment ?? null,
      });
      const report: Report = {
        id,
        placeId: body.placeId,
        attribute: body.attribute,
        value: body.value,
        comment: body.comment ?? null,
        photoUrl: null,
        status: "new",
        createdAt: now,
        decidedAt: null,
      };
      return json(report, previous?.kind === "report" ? 200 : 201);
    }

    const placeId = decodeURIComponent((confirmation ?? list ?? withdraw)![1]);
    const place = getPlace(placeId);
    if (!place) return problem(404, "Not found", `Place "${placeId}" does not exist.`);

    if (confirmation) {
      const body = (await input.json()) as ConfirmationCreate;
      const resolved = place.attributes.find((a) => a.facts.some((f) => f.id === body.factId));
      const fact = resolved?.facts.find((f) => f.id === body.factId);
      if (!resolved || !fact) return problem(404, "Not found", `Place "${placeId}" has no current fact "${body.factId}".`);
      const key = keyOf(token, placeId, resolved.attribute);
      const previous = stored.get(key);
      const same = previous?.kind === "confirmation" && previous.factId === fact.id;
      const entry: Stored = same
        ? previous
        : {
            kind: "confirmation",
            id: `conf_mock_${++seq}`,
            attribute: resolved.attribute,
            value: fact.value,
            factId: fact.id,
            createdAt: now,
            placeId,
            comment: body.comment ?? null,
          };
      stored.set(key, entry);
      const response: Confirmation = { id: entry.id, placeId, factId: fact.id, comment: entry.comment, createdAt: entry.createdAt };
      return json(response, same ? 200 : 201);
    }

    if (list) {
      const items = [...stored.entries()]
        .filter(([key, entry]) => key.startsWith(`${token}|`) && entry.placeId === placeId)
        .map(([, e]): Contribution => ({
          kind: e.kind,
          id: e.id,
          attribute: e.attribute,
          value: e.value,
          factId: e.factId,
          createdAt: e.createdAt,
        }));
      return json({ items });
    }

    stored.delete(keyOf(token, placeId, decodeURIComponent(withdraw![2]) as AccessibilityAttribute));
    return new Response(null, { status: 204 });
  };
}
