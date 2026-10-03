import createClient, { type ClientOptions } from "openapi-fetch";
import type { components, operations, paths } from "./generated/schema";

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
export type CategoryList = Schemas["CategoryList"];
export type Profile = Schemas["Profile"];
export type Reliability = Schemas["Reliability"];
export type ReliabilityStatus = Schemas["ReliabilityStatus"];
export type FactValue = Schemas["FactValue"];
export type FactStatus = Schemas["FactStatus"];
export type SourceKind = Schemas["SourceKind"];
export type SourceRefreshStatus = Schemas["SourceRefreshStatus"];
export type ReportStatus = Schemas["ReportStatus"];
export type PlaceList = Schemas["PlaceList"];
export type FeatureFilter = Schemas["FeatureFilter"];
export type FeatureMatch = Schemas["FeatureMatch"];
export type SummaryChip = Schemas["SummaryChip"];
export type Verdict = Schemas["Verdict"];
export type NeedResult = Schemas["NeedResult"];
export type Need = Schemas["Need"];
export type NeedVerdict = Schemas["NeedVerdict"];

export type ListPlacesQuery = NonNullable<operations["listPlaces"]["parameters"]["query"]>;
export type GetPlaceQuery = NonNullable<operations["getPlace"]["parameters"]["query"]>;
export type ReportCreate = Schemas["ReportCreate"];
export type Confirmation = Schemas["Confirmation"];
export type ConfirmationCreate = Schemas["ConfirmationCreate"];
export type PendingReport = Schemas["PendingReport"];
export type ModerationReport = Schemas["ModerationReport"];
export type ModerationDecision = Schemas["ModerationDecision"];
export type ModeratorSession = Schemas["ModeratorSession"];
export type ModerationDecisionKind = Schemas["ModerationDecisionKind"];
export type ModerationEvent = Schemas["ModerationEvent"];
export type RouteRequest = Schemas["RouteRequest"];
export type RouteSegment = Schemas["RouteSegment"];
export type CityStats = Schemas["CityStats"];
export type CityNeedStats = Schemas["CityNeedStats"];
export type PriorityFactor = Schemas["PriorityFactor"];
export type PriorityCriterion = Schemas["PriorityCriterion"];
export type PriorityItem = Schemas["PriorityItem"];
export type PriorityAction = Schemas["PriorityAction"];
export type Outage = Schemas["Outage"];
export type OutageEquipment = Schemas["OutageEquipment"];
export type OutageState = Schemas["OutageState"];
export type OutageVote = Schemas["OutageVote"];
export type OutageCreate = Schemas["OutageCreate"];
export type OutageVoteCreate = Schemas["OutageVoteCreate"];

/** Base path of the v1 API on the app's own origin. */
export const API_BASE_PATH = "/api/v1";

/** Typed client for the v1 API. Defaults to same-origin `API_BASE_PATH`. */
export function createApiClient(options: ClientOptions = {}) {
  return createClient<paths>({ baseUrl: API_BASE_PATH, ...options });
}

export { outageRules, type OutageRules } from "./outage-rules";
export { checkReportNumber, reportRules, type RangeCheck, type ReportRules, type ValueRange } from "./report-rules";
export {
  categories,
  isKnownCategory,
  toCategoryDefinition,
  type CategoryConfig,
  type CategoryDefinition,
  type OsmTagRule,
} from "./categories";
export { createMockFetch, type MockChoice, type MockFetchOptions, type OperationId } from "./mock";

/** Response examples from `openapi.yaml`, typed against the spec — the source for front-end mocks. */
export { responseExamples } from "./generated/examples";
