import { responseExamples, type Place, type Problem, type SimulatedSourceOutage, type Source } from "@krakow-bez-barier/contracts";
import { localeFromCookies } from "@/i18n/locale";
import { messagesFor } from "@/i18n/messages";
import { EXAMPLE_PLACES } from "./mock-api";
import { mockModeratorSession } from "./mock-moderation";

// In-browser stand-in for the demo switch "Symuluj awarię źródła" in the example-data mode (tests, demo recording):
// the running simulations overlay `GET /sources` and `GET /places/{id}` like the API's do. Kept in sessionStorage, so
// they survive a full page load within the tab, as the API's survive across server instances.

/** Mirrors the server's `SIMULATION_MINUTES` (spec: `durationMinutes`). */
export const MOCK_SIMULATION_MINUTES = 15;

const STORAGE_KEY = "kbb-mock-source-outages";

let memory: SimulatedSourceOutage[] = [];

function load(now: Date): SimulatedSourceOutage[] {
  try {
    const stored = globalThis.sessionStorage?.getItem(STORAGE_KEY);
    if (stored) memory = JSON.parse(stored) as SimulatedSourceOutage[];
  } catch {
    // Storage blocked: the in-memory list still works for this page.
  }
  return memory.filter((s) => !s.stoppedAt && Date.parse(s.endsAt) > now.getTime());
}

function save(list: SimulatedSourceOutage[]) {
  memory = list;
  try {
    globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage blocked: kept in memory only.
  }
}

/** Forgets every simulation (tests). */
export function resetMockSourceOutages() {
  save([]);
}

/** Every source the example data knows, by id: the source list's and the example places'. */
function knownSources(): Map<string, Source> {
  const listed = Object.values(responseExamples.listSources[200]).flatMap((list) => list.items);
  return new Map([...EXAMPLE_PLACES.flatMap((p) => p.sources), ...listed].map((s) => [s.id, s]));
}

function overlaySource(source: Source, running: Set<string>): Source {
  if (!running.has(source.id)) return source;
  const locale = localeFromCookies(typeof document === "undefined" ? null : document.cookie);
  const note = messagesFor(locale).pages.aboutData.statusNote.simulatedOutage;
  return { ...source, refreshStatus: "outage", statusNote: note, lastAttemptAt: new Date().toISOString(), simulatedOutage: true };
}

function overlayPlace(place: Place, running: Set<string>): Place {
  return {
    ...place,
    sources: place.sources.map((s) => overlaySource(s, running)),
    attributes: place.attributes.map((a) => ({
      ...a,
      facts: a.facts.map((f) => (running.has(f.source.id) ? { ...f, stale: true } : f)),
    })),
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": status < 400 ? "application/json" : "application/problem+json" },
  });

const problem = (status: number, title: string, detail: string) =>
  json({ type: "about:blank", title, status, detail } satisfies Problem, status);

type Fetch = (input: Request) => Promise<Response>;

/** Answers `/moderation/source-outages[/{sourceId}]` and overlays running simulations on `/sources` and `/places/{id}`. */
export function withSourceOutageMocks(fallback: Fetch): Fetch {
  return async (input) => {
    const path = new URL(input.url, "http://mock.local").pathname.replace(/^.*\/api\/v1/, "");
    const now = new Date();

    if (input.method === "GET" && (path === "/sources" || /^\/places\/[^/]+$/.test(path))) {
      const res = await fallback(input);
      const running = new Set(load(now).map((s) => s.sourceId));
      if (!res.ok || running.size === 0) return res;
      const body = await res.json();
      return json(path === "/sources" ? { items: (body.items as Source[]).map((s) => overlaySource(s, running)) } : overlayPlace(body, running));
    }

    const match = path.match(/^\/moderation\/source-outages(?:\/([^/]+))?$/);
    if (!match) return fallback(input);
    const token = /^Bearer\s+(\S.*)$/i.exec(input.headers.get("authorization") ?? "")?.[1]?.trim();
    if (!token) return problem(401, "Unauthorized", "A valid moderator token is required.");
    const moderator = mockModeratorSession(token);
    const running = load(now);
    const sourceId = match[1] && decodeURIComponent(match[1]);

    if (!sourceId && input.method === "GET") {
      return json({ items: running, durationMinutes: MOCK_SIMULATION_MINUTES, moderator });
    }
    if (sourceId && input.method === "PUT") {
      const source = knownSources().get(sourceId);
      if (!source || source.kind === "user_report") return problem(404, "Not found", `Source "${sourceId}" does not exist.`);
      const endsAt = new Date(now.getTime() + MOCK_SIMULATION_MINUTES * 60_000).toISOString();
      const current = running.find((s) => s.sourceId === sourceId);
      const simulation: SimulatedSourceOutage = current
        ? { ...current, endsAt }
        : { sourceId, sourceName: source.name, startedBy: moderator.name, startedAt: now.toISOString(), endsAt, stoppedAt: null };
      save([simulation, ...running.filter((s) => s.sourceId !== sourceId)]);
      return json(simulation);
    }
    if (sourceId && input.method === "DELETE") {
      const current = running.find((s) => s.sourceId === sourceId);
      if (!current) return problem(404, "Not found", `No simulated outage of "${sourceId}" is running.`);
      save(running.filter((s) => s.sourceId !== sourceId));
      return json({ ...current, stoppedAt: now.toISOString() } satisfies SimulatedSourceOutage);
    }
    return fallback(input);
  };
}
