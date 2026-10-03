import { createApiClient } from "@krakow-bez-barier/contracts";
import { mockFetch } from "./mocks/mock-fetch";

// TODO(KBB-28): mocks stay on by default until the places API exists; set NEXT_PUBLIC_API_MOCKS=false
// to call the real route handlers.
const useMocks = process.env.NEXT_PUBLIC_API_MOCKS !== "false";

/** The one typed API client for client components (generated from openapi.yaml). */
export const api = createApiClient(useMocks ? { fetch: mockFetch } : {});
