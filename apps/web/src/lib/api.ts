import { createApiClient } from "@krakow-bez-barier/contracts";

// The real API is the default. NEXT_PUBLIC_API_MOCK=true (read at build time) answers from the spec's examples
// instead — only the e2e dev server and the demo recording set it, because their specs open sample places by id.
export const isMockApi = process.env.NEXT_PUBLIC_API_MOCK === "true";

// Loaded on first use, so the real-data bundle doesn't carry the spec's examples.
let mockFetch: Promise<(input: Request) => Promise<Response>> | undefined;
const fetchFromExamples = async (input: Request) => {
  mockFetch ??= import("./mocks").then((mocks) => mocks.mockApiFetch);
  return (await mockFetch)(input);
};

/** Typed API client for Client Components (React Query). */
export const api = createApiClient(isMockApi ? { fetch: fetchFromExamples } : {});
