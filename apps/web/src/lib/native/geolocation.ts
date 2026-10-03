import { Capacitor } from "@capacitor/core";

// One way to ask for the device position: the native plugin inside the Capacitor app (native
// permission prompt), the browser Geolocation API elsewhere. The position never leaves the device
// (US-6.6) — callers use it locally and must not send it to the server.

export type DevicePosition = { latitude: number; longitude: number; accuracyMeters: number };
export type LocateFailure = "denied" | "unavailable" | "unsupported";
export type LocateResult = { ok: true; position: DevicePosition } | { ok: false; reason: LocateFailure };

const OPTIONS = { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 };

export type AppPlatform = "ios" | "android" | "web";

export function appPlatform(): AppPlatform {
  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "android" ? platform : "web";
}

export function locateDevice(): Promise<LocateResult> {
  return Capacitor.isNativePlatform() ? locateNative() : locateInBrowser();
}

async function locateNative(): Promise<LocateResult> {
  const { Geolocation } = await import("@capacitor/geolocation");
  try {
    const permission = await Geolocation.requestPermissions({ permissions: ["location"] });
    // Android 12+ "approximate": location is denied but coarseLocation is granted, which is enough.
    if (permission.location === "denied" && permission.coarseLocation !== "granted") {
      return { ok: false, reason: "denied" };
    }
    const { coords } = await Geolocation.getCurrentPosition(OPTIONS);
    return { ok: true, position: toPosition(coords) };
  } catch {
    // Thrown when location services are off or no fix arrives in time.
    return { ok: false, reason: "unavailable" };
  }
}

function locateInBrowser(): Promise<LocateResult> {
  const geolocation = typeof navigator === "undefined" ? undefined : navigator.geolocation;
  if (!geolocation) return Promise.resolve({ ok: false, reason: "unsupported" });
  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      ({ coords }) => resolve({ ok: true, position: toPosition(coords) }),
      (error) => resolve({ ok: false, reason: error.code === error.PERMISSION_DENIED ? "denied" : "unavailable" }),
      OPTIONS,
    );
  });
}

function toPosition(coords: { latitude: number; longitude: number; accuracy: number }): DevicePosition {
  return { latitude: coords.latitude, longitude: coords.longitude, accuracyMeters: Math.round(coords.accuracy) };
}
