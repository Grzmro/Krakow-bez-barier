import { createMockFetch } from "@krakow-bez-barier/contracts";
import { withCityMocks } from "./mock-city";
import { withContributionMocks } from "./mock-contributions";
import { withPlacesMocks } from "./mock-fetch";
import { mockGetPlace, mockPlaceExists } from "./mock-api";
import { seedModerationQueue, withModerationMocks } from "./mock-moderation";
import { withOutageMocks } from "./mock-outages";
import { withRealRoutes } from "./mock-routes";

const queue = seedModerationQueue();

/** `fetch` of the example-data mode: answers from openapi.yaml's examples, except routes (see mock-routes). */
export const mockApiFetch = withRealRoutes(
  withOutageMocks(
    withCityMocks(
      withModerationMocks(withPlacesMocks(withContributionMocks(createMockFetch(), (id) => mockGetPlace(id))), queue),
      queue,
    ),
    mockPlaceExists,
  ),
);
