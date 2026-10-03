import { describe, expect, it } from "vitest";
import { locateMeIdle, locateMeReducer, type LocateMeState } from "./locate-me";

const position = { latitude: 50.0647, longitude: 19.945, accuracyMeters: 20 };

describe("locateMeReducer", () => {
  it("starts locating from idle", () => {
    // GIVEN the button was not used yet
    // WHEN it is pressed
    // THEN the state is locating
    expect(locateMeReducer(locateMeIdle, { type: "start" })).toEqual({ status: "locating" });
  });

  it("keeps the position when the device was found", () => {
    // GIVEN a lookup in progress
    const locating: LocateMeState = { status: "locating" };
    // WHEN the position comes back
    const next = locateMeReducer(locating, { type: "finish", result: { ok: true, position } });
    // THEN the state is located at that position
    expect(next).toEqual({ status: "located", position });
  });

  it.each(["denied", "off", "unavailable", "timeout", "insecure", "unsupported"] as const)("fails with %s", (reason) => {
    // GIVEN a lookup in progress
    // WHEN it fails
    const next = locateMeReducer({ status: "locating" }, { type: "finish", result: { ok: false, reason } });
    // THEN the reason is kept, so the screen can say what to do
    expect(next).toEqual({ status: "failed", reason });
  });

  it("ignores a result that arrives when no lookup is running", () => {
    // GIVEN idle (e.g. the lookup was superseded)
    // WHEN a result arrives
    // THEN nothing changes
    expect(locateMeReducer(locateMeIdle, { type: "finish", result: { ok: true, position } })).toBe(locateMeIdle);
  });

  it("can be retried after a failure", () => {
    // GIVEN a denied lookup
    const failed: LocateMeState = { status: "failed", reason: "denied" };
    // WHEN the button is pressed again
    // THEN it locates again
    expect(locateMeReducer(failed, { type: "start" })).toEqual({ status: "locating" });
  });

  it("dismisses an error but not a running lookup", () => {
    // GIVEN a failure and a running lookup
    // WHEN the message is dismissed
    // THEN only the failure goes away
    expect(locateMeReducer({ status: "failed", reason: "timeout" }, { type: "dismiss" })).toEqual(locateMeIdle);
    const locating: LocateMeState = { status: "locating" };
    expect(locateMeReducer(locating, { type: "dismiss" })).toBe(locating);
  });
});
