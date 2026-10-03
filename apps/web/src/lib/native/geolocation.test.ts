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

  it.each([
    ["OS-PLUG-GLOC-0003", "denied"],
    ["OS-PLUG-GLOC-0008", "denied"],
    ["OS-PLUG-GLOC-0007", "off"],
    ["OS-PLUG-GLOC-0017", "off"],
    ["OS-PLUG-GLOC-0002", "unavailable"],
  ] as const)("maps plugin error %s from the permission request to %s", async (code, reason) => {
    // GIVEN the permission request fails with a plugin error code
    requestPermissions.mockRejectedValue(Object.assign(new Error(code), { code }));

    // WHEN the app locates the device
    const result = await locateDevice();

    // THEN the failure has its own reason, not one catch-all
    expect(result).toEqual({ ok: false, reason });
  });

  it("retries with GPS after a coarse fix times out", async () => {
    // GIVEN access granted, the quick fix times out and the GPS fix arrives
    requestPermissions.mockResolvedValue({ location: "granted", coarseLocation: "granted" });
    getCurrentPosition
      .mockRejectedValueOnce(Object.assign(new Error("timeout"), { code: "OS-PLUG-GLOC-0010" }))
      .mockResolvedValueOnce({ coords: WAWEL, timestamp: 0 });

    // WHEN the app locates the device
    const result = await locateDevice();

    // THEN the second, high-accuracy attempt gives the position
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(getCurrentPosition.mock.calls[1][0]).toMatchObject({ enableHighAccuracy: true });
    expect(result).toEqual({ ok: true, position: { latitude: 50.0541, longitude: 19.9354, accuracyMeters: 19 } });
  });

  it("reports a timeout when the GPS retry times out too", async () => {
    // GIVEN access granted and no fix arrives in time on either attempt
    requestPermissions.mockResolvedValue({ location: "granted", coarseLocation: "granted" });
    getCurrentPosition.mockRejectedValue(Object.assign(new Error("timeout"), { code: "OS-PLUG-GLOC-0010" }));

    // WHEN the app locates the device
    const result = await locateDevice();

    // THEN it fails as a timeout
    expect(result).toEqual({ ok: false, reason: "timeout" });
  });
});

describe("locateDevice in a browser", () => {
  beforeEach(() => isNativePlatform.mockReturnValue(false));

  function stubBrowserGeolocation(impl: (ok: PositionCallback, fail: PositionErrorCallback, options?: PositionOptions) => void) {
    const getCurrentPosition = vi.fn(impl);
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    return getCurrentPosition;
  }

  const browserError = (code: number) =>
    ({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }) as GeolocationPositionError;

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
    [1, "denied", 1],
    [2, "unavailable", 2],
    [3, "timeout", 2],
  ] as const)("maps browser error code %i to %s", async (code, reason, attempts) => {
    // GIVEN the browser fails with the given error code every time
    const getCurrentPosition = stubBrowserGeolocation((_, fail) => fail(browserError(code)));

    // WHEN the app locates the device
    const result = await locateDevice();

    // THEN the failure reason is mapped; only a missing fix is retried, a refusal is not
    expect(result).toEqual({ ok: false, reason });
    expect(getCurrentPosition).toHaveBeenCalledTimes(attempts);
  });

  it("retries with high accuracy after the quick fix fails", async () => {
    // GIVEN a browser whose coarse fix times out but whose GPS fix works
    const getCurrentPosition = stubBrowserGeolocation((ok, fail, options) =>
      options?.enableHighAccuracy ? ok({ coords: WAWEL } as GeolocationPosition) : fail(browserError(3)),
    );

    // WHEN the app locates the device
    const result = await locateDevice();

    // THEN the second attempt gives the position
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true, position: { latitude: 50.0541, longitude: 19.9354, accuracyMeters: 19 } });
  });

  it("reports an insecure page without asking the browser", async () => {
    // GIVEN the app opened over plain http from a LAN address
    vi.stubGlobal("window", { isSecureContext: false });
    const getCurrentPosition = stubBrowserGeolocation(() => {});

    // WHEN the app locates the device
    const result = await locateDevice();

    // THEN it fails as insecure: browsers refuse geolocation outside https and localhost
    expect(result).toEqual({ ok: false, reason: "insecure" });
    expect(getCurrentPosition).not.toHaveBeenCalled();
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
