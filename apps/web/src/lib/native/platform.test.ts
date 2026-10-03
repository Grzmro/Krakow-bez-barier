import { afterEach, describe, expect, it, vi } from "vitest";

const getPlatform = vi.fn<() => string>();
vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform } }));

const { locationSettings } = await import("./platform");

afterEach(() => vi.unstubAllGlobals());

describe("locationSettings", () => {
  it("points to the native app's settings inside the Capacitor app", () => {
    // GIVEN the Android app
    getPlatform.mockReturnValue("android");

    // WHEN / THEN the app's own settings are meant
    expect(locationSettings()).toBe("android-app");
  });

  it.each([
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15", 5, "ios"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", 5, "ios"],
    ["Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/130.0", 5, "android"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0", 0, "other"],
  ] as const)("recognises the browser's OS from %s", (userAgent, maxTouchPoints, expected) => {
    // GIVEN a browser (an installed PWA included) on a given device
    getPlatform.mockReturnValue("web");
    vi.stubGlobal("navigator", { userAgent, maxTouchPoints });

    // WHEN / THEN the settings path matches the OS (an iPad reports itself as a Mac with touch)
    expect(locationSettings()).toBe(expected);
  });
});
