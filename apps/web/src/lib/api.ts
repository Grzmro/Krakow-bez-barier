import { createApiClient, createMockFetch } from "@krakow-bez-barier/contracts";
import { withPlacesMocks } from "./mocks/mock-fetch";
import { withModerationMocks } from "./mocks/mock-moderation";
import { withRealRoutes } from "./mocks/mock-routes";

// TODO(KBB-28): only GET /sources and /health are served so far (KBB-29), so by default the client answers from the
// spec's examples. Set NEXT_PUBLIC_API_MOCK=false to use the real endpoints (needs DATABASE_URL).
export const isMockApi = process.env.NEXT_PUBLIC_API_MOCK !== "false";

/** Typed API client for Client Components (React Query). */
export const api = createApiClient(isMockApi ? { fetch: withRealRoutes(withModerationMocks(withPlacesMocks(createMockFetch()))) } : {});
