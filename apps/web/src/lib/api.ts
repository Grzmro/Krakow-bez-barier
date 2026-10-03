import { createApiClient, createMockFetch } from "@krakow-bez-barier/contracts";

// TODO(KBB-29): the API routes don't exist yet, so the client answers from the spec's examples.
// Set NEXT_PUBLIC_API_MOCK=false once the real endpoints are served.
export const isMockApi = process.env.NEXT_PUBLIC_API_MOCK !== "false";

/** Typed API client for Client Components (React Query). */
export const api = createApiClient(isMockApi ? { fetch: createMockFetch() } : {});
