import { describe, expect, it } from "vitest";
import { outageRules } from "./outage-rules";

describe("outageRules", () => {
  it("are extracted from reportOutage's x-outage-rules in openapi.yaml", () => {
    // GIVEN the rules generated from the spec
    // WHEN reading them
    // THEN they match the spec
    expect(outageRules).toEqual({ confirmationsToConfirm: 2, workingVotesToResolve: 1, expiresAfterHours: 48 });
  });
});
