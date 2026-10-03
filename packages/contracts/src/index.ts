import createClient, { type ClientOptions } from "openapi-fetch";
import type { components, paths } from "./generated/schema";

export type { components, operations, paths } from "./generated/schema";

type Schemas = components["schemas"];

export type Place = Schemas["Place"];
export type PlaceSummary = Schemas["PlaceSummary"];
export type AccessibilityFact = Schemas["AccessibilityFact"];
export type ResolvedAttribute = Schemas["ResolvedAttribute"];
export type Source = Schemas["Source"];
export type Report = Schemas["Report"];
export type Route = Schemas["Route"];
export type Problem = Schemas["Problem"];
export type AccessibilityAttribute = Schemas["AccessibilityAttribute"];
export type Category = Schemas["Category"];
export type Profile = Schemas["Profile"];
export type Reliability = Schemas["Reliability"];
export type ReliabilityStatus = Schemas["ReliabilityStatus"];
export type FactValue = Schemas["FactValue"];
export type FactStatus = Schemas["FactStatus"];
export type SourceKind = Schemas["SourceKind"];
export type SourceRefreshStatus = Schemas["SourceRefreshStatus"];
export type ReportStatus = Schemas["ReportStatus"];

/** Typed client for the v1 API. Defaults to same-origin `/api/v1`. */
export function createApiClient(options: ClientOptions = {}) {
  return createClient<paths>({ baseUrl: "/api/v1", ...options });
}

export { createMockFetch, type MockChoice, type MockFetchOptions, type OperationId } from "./mock";
