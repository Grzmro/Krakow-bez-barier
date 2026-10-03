import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isNativePlatform = vi.fn<() => boolean>();
const requestPermissions = vi.fn();
const getCurrentPosition = vi.fn();

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform } }));
vi.mock("@capacitor/geolocation", () => ({ Geolocation: { requestPermissions, getCurrentPosition } }));

const { locateDevice } = await import("./geolocation");

const WAWEL = { latitude: 50.0541, longitude: 19.9354, accuracy: 18.6 };

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("locateDevice in the native app", () => {
  beforeEach(() => isNativePlatform.mockReturnValue(true));

  it("asks for permission natively and returns the position", async () => {
    // GIVEN the user grants location access
    requestPermissions.mockResolvedValue({ location: "granted", coarseLocation: "granted" });
    getCurrentPosition.mockResolvedValue({ coords: WAWEL, timestamp: 0 });

    // WHEN the app locates the device
    const result = await locateDevice();

    // THEN the native prompt was used and the position is rounded to whole meters
    expect(requestPermissions).toHaveBeenCalledWith({ permissions: ["location"] });
    expect(result).toEqual({ ok: true, position: { latitude: 50.0541, longitude: 19.9354, accuracyMeters: 19 } });
  });

  it("reports a denied permission without asking for a fix", async () => {
    // GIVEN the user denies location access
    requestPermissions.mockResolvedValue({ location: "denied", coarseLocation: "denied" });

    // WHEN the app locates the device
    const result = await locateDevice();

    // THEN it fails as denied
    expect(result).toEqual({ ok: false, reason: "denied" });
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("accepts approximate location on Android", async () => {
    // GIVEN the user picks "approximate" on Android 12+
    requestPermissions.mockResolvedValue({ location: "denied", coarseLocation: "granted" });
    getCurrentPosition.mockResolvedValue({ coords: WAWEL, timestamp: 0 });

    // WHEN the app locates the device
    const result = await locateDevice();

    // THEN the coarse position is used
    expect(result).toEqual({ ok: true, position: { latitude: 50.0541, longitude: 19.9354, accuracyMeters: 19 } });
  });

  it("reports unavailable when location services fail", async () => {
    // GIVEN location services are off
    requestPermissions.mockRejectedValue(new Error("Location services are not enabled"));

    // WHEN the app locates the device
    const result = await locateDevice();

    // THEN it fails as unavailable
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("locateDevice in a browser", () => {
  beforeEach(() => isNativePlatform.mockReturnValue(false));

  function stubBrowserGeolocation(impl: (ok: PositionCallback, fail: PositionErrorCallback) => void) {
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: vi.fn(impl) } });
  }

  it("uses the Geolocation API and never the native plugin", async () => {
    // GIVEN a browser that knows the position
    stubBrowserGeolocation((ok) => ok({ coords: WAWEL } as GeolocationPosition));

    // WHEN the app locates the device
    const result = await locateDevice();

    // THEN the browser position is returned
    expect(result).toEqual({ ok: true, position: { latitude: 50.0541, longitude: 19.9354, accuracyMeters: 19 } });
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it.each([
    [1, "denied"],
    [2, "unavailable"],
    [3, "unavailable"],
  ] as const)("maps browser error code %i to %s", async (code, reason) => {
    // GIVEN the browser fails with the given error code
    stubBrowserGeolocation((_, fail) =>
      fail({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError),
    );

    // WHEN the app locates the device
    const result = await locateDevice();

    // THEN the failure reason is mapped
    expect(result).toEqual({ ok: false, reason });
  });

  it("reports unsupported without the Geolocation API", async () => {
    // GIVEN a browser without geolocation
    vi.stubGlobal("navigator", {});

    // WHEN the app locates the device
    const result = await locateDevice();

    // THEN it fails as unsupported
    expect(result).toEqual({ ok: false, reason: "unsupported" });
  });
});
