import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isNativePlatform = vi.fn<() => boolean>();
const requestPermissions = vi.fn();
const watchPosition = vi.fn();
const clearWatch = vi.fn();

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform } }));
vi.mock("@capacitor/geolocation", () => ({ Geolocation: { requestPermissions, watchPosition, clearWatch } }));

const { watchDevice } = await import("./geolocation");

const WAWEL = { latitude: 50.0541, longitude: 19.9354, accuracy: 18.6 };
const POSITION = { latitude: 50.0541, longitude: 19.9354, accuracyMeters: 19 };

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("watchDevice in a browser", () => {
  beforeEach(() => isNativePlatform.mockReturnValue(false));

  it("passes on every position and clears the watch when stopped", () => {
    // GIVEN a browser that reports two positions
    const browserWatch = vi.fn((ok: PositionCallback) => {
      ok({ coords: WAWEL } as GeolocationPosition);
      ok({ coords: { ...WAWEL, latitude: 50.06 } } as GeolocationPosition);
      return 7;
    });
    const browserClear = vi.fn();
    vi.stubGlobal("navigator", { geolocation: { watchPosition: browserWatch, clearWatch: browserClear } });
    const onPosition = vi.fn();

    // WHEN the app watches and then stops
    const stop = watchDevice(onPosition, vi.fn());
    stop();

    // THEN both positions arrived and the same watch was cleared
    expect(onPosition).toHaveBeenNthCalledWith(1, POSITION);
    expect(onPosition).toHaveBeenNthCalledWith(2, { ...POSITION, latitude: 50.06 });
    expect(browserClear).toHaveBeenCalledWith(7);
  });

  it.each([
    [1, "denied"],
    [2, "unavailable"],
  ] as const)("maps browser error code %i to %s", (code, reason) => {
    // GIVEN the browser fails with the given error code
    vi.stubGlobal("navigator", {
      geolocation: {
        watchPosition: (_: PositionCallback, fail: PositionErrorCallback) =>
          fail({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError),
        clearWatch: vi.fn(),
      },
    });
    const onFailure = vi.fn();

    // WHEN the app watches
    watchDevice(vi.fn(), onFailure);

    // THEN the failure reason is mapped
    expect(onFailure).toHaveBeenCalledWith(reason);
  });

  it("reports unsupported without the Geolocation API", () => {
    // GIVEN a browser without geolocation
    vi.stubGlobal("navigator", {});
    const onFailure = vi.fn();

    // WHEN the app watches
    watchDevice(vi.fn(), onFailure);

    // THEN it fails as unsupported
    expect(onFailure).toHaveBeenCalledWith("unsupported");
  });
});

describe("watchDevice in the native app", () => {
  beforeEach(() => isNativePlatform.mockReturnValue(true));

  it("asks for permission natively, passes on positions and clears the watch", async () => {
    // GIVEN the user grants location access and the plugin reports a position
    requestPermissions.mockResolvedValue({ location: "granted", coarseLocation: "granted" });
    watchPosition.mockImplementation(async (_options, callback) => {
      callback({ coords: WAWEL, timestamp: 0 });
      return "watch-1";
    });
    const onPosition = vi.fn();

    // WHEN the app watches, then stops
    const stop = watchDevice(onPosition, vi.fn());
    await vi.waitFor(() => expect(onPosition).toHaveBeenCalledWith(POSITION));
    stop();

    // THEN the native watch is cleared
    expect(clearWatch).toHaveBeenCalledWith({ id: "watch-1" });
  });

  it("reports a denied permission without watching", async () => {
    // GIVEN the user denies location access
    requestPermissions.mockResolvedValue({ location: "denied", coarseLocation: "denied" });
    const onFailure = vi.fn();

    // WHEN the app watches
    watchDevice(vi.fn(), onFailure);

    // THEN it fails as denied
    await vi.waitFor(() => expect(onFailure).toHaveBeenCalledWith("denied"));
    expect(watchPosition).not.toHaveBeenCalled();
  });
});
