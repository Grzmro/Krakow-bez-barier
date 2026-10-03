import { createMockFetch } from "@krakow-bez-barier/contracts";
import { withPlacesMocks } from "./mock-fetch";
import { withModerationMocks } from "./mock-moderation";
import { withRealRoutes } from "./mock-routes";

/** `fetch` of the example-data mode: answers from openapi.yaml's examples, except routes (see mock-routes). */
export const mockApiFetch = withRealRoutes(withModerationMocks(withPlacesMocks(createMockFetch())));
