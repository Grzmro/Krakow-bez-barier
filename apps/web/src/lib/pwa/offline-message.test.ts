import { describe, expect, it } from "vitest";
import { offlineMessage } from "./offline-message";

describe("offlineMessage", () => {
  it("names the date and Kraków time the data was last stored", () => {
    // GIVEN data stored at 12:20 UTC on 3 October 2026 (14:20 in Kraków)
    // WHEN building the banner text
    const text = offlineMessage("2026-10-03T12:20:00.000Z", "pl");

    // THEN it shows the Polish date and local time
    expect(text).toBe("Jesteś offline — pokazujemy dane z 3 października 2026 14:20.");
  });

  it.each([null, "", "not-a-date"])("says only that the device is offline for %j", (value) => {
    // GIVEN no usable timestamp
    // WHEN building the banner text
    // THEN it doesn't invent a date
    expect(offlineMessage(value, "pl")).toBe("Jesteś offline.");
  });
});
