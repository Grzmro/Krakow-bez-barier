import avoidSteps from "./fixtures/dworzec-rynek-avoid-steps.json";
import shortest from "./fixtures/dworzec-rynek-shortest.json";
import stroller from "./fixtures/dworzec-rynek-stroller.json";
import wheelchair from "./fixtures/dworzec-rynek-wheelchair.json";
import avoidStepsEn from "./fixtures/dworzec-rynek-avoid-steps-en.json";
import shortestEn from "./fixtures/dworzec-rynek-shortest-en.json";
import strollerEn from "./fixtures/dworzec-rynek-stroller-en.json";
import wheelchairEn from "./fixtures/dworzec-rynek-wheelchair-en.json";
import { ORS_ATTRIBUTION, errorFor, orsRequest, parseOrsResponse, type OrsRequest } from "./ors";
import { RoutingError, type RoutingProvider } from "./provider";

/** An openrouteservice answer recorded by `scripts/record-ors-fixtures.mjs`, with the key-free request. */
export type RecordedRoute = { request: OrsRequest; recordedAt: string; status: number; response: unknown };

// Key order differs between a hand-built request and parsed JSON; compare canonical forms.
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  );

/** Dworzec Główny → Rynek Główny, the demo route, recorded for each request the app makes for it (per language). */
export const DEMO_ROUTES = [
  shortest,
  avoidSteps,
  wheelchair,
  stroller,
  shortestEn,
  avoidStepsEn,
  wheelchairEn,
  strollerEn,
] as RecordedRoute[];

/**
 * Answers from recorded responses instead of calling openrouteservice: for tests (no network) and the example-data
 * mode. A request that wasn't recorded fails as an unavailable provider.
 */
export function createRecordedProvider(recorded: RecordedRoute[] = DEMO_ROUTES): RoutingProvider {
  return {
    attribution: ORS_ATTRIBUTION,
    async route(request) {
      const wanted = canonical(orsRequest(request));
      const match = recorded.find((r) => canonical(r.request) === wanted);
      if (!match) throw new RoutingError("unavailable", "no recorded route for this request");
      if (match.status !== 200) throw errorFor(match.status, match.response);
      return { ...parseOrsResponse(match.response), fetchedAt: new Date(match.recordedAt) };
    },
  };
}
