import { createMockFetch } from "@krakow-bez-barier/contracts";
import { withCityMocks } from "./mock-city";
import { withPlacesMocks } from "./mock-fetch";
import { seedModerationQueue, withModerationMocks } from "./mock-moderation";
import { withRealRoutes } from "./mock-routes";

const queue = seedModerationQueue();

/** `fetch` of the example-data mode: answers from openapi.yaml's examples, except routes (see mock-routes). */
export const mockApiFetch = withRealRoutes(
  withCityMocks(withModerationMocks(withPlacesMocks(createMockFetch()), queue), queue),
);
