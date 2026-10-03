import { describe, expect, it } from "vitest";
import { createRecordedProvider } from "./recorded-provider";

describe("the recorded demo provider", () => {
  it("reports a request it never recorded as a missing key, not as an outage", async () => {
    // GIVEN the recorded provider and a route it has no answer for
    const provider = createRecordedProvider([]);

    // WHEN asking for it
    const attempt = provider.route({ from: [19.9, 50.0], to: [19.95, 50.06], mode: "foot", avoidSteps: false, locale: "pl" });

    // THEN the failure says routing is not configured
    await expect(attempt).rejects.toMatchObject({ kind: "not_configured" });
  });
});
