import { Capacitor } from "@capacitor/core";

// One way to ask for the device position: the native plugin inside the Capacitor app (native
// permission prompt), the browser Geolocation API elsewhere. The exact position never leaves the device
// (US-6.6): callers use it locally; only a coarse, grid-snapped area (`searchArea` in lib/nearby.ts) may
// be sent to the server.

export type DevicePosition = { latitude: number; longitude: number; accuracyMeters: number };
/**
 * Why no position: `denied` permission refused, `off` location services switched off (native only;
 * browsers report it as `unavailable`), `unavailable` no fix, `timeout` no fix in time, `insecure` the page
 * is not on https or localhost (browsers refuse geolocation there), `unsupported` no Geolocation API.
 */
export type LocateFailure = "denied" | "off" | "unavailable" | "timeout" | "insecure" | "unsupported";
export type LocateResult = { ok: true; position: DevicePosition } | { ok: false; reason: LocateFailure };

/** First try: a fast, coarse fix (Wi-Fi / cell) or a recent cached one. */
const QUICK = { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 };
/** Second try after no fix or a timeout: GPS, which works without network location but needs longer. */
const PRECISE = { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 };

export function locateDevice(): Promise<LocateResult> {
  return Capacitor.isNativePlatform() ? locateNative() : locateInBrowser();
}

const retryable = (result: LocateResult) => !result.ok && (result.reason === "unavailable" || result.reason === "timeout");

async function locateNative(): Promise<LocateResult> {
  const { Geolocation } = await import("@capacitor/geolocation");
  try {
    const permission = await Geolocation.requestPermissions({ permissions: ["location"] });
    // Android 12+ "approximate": location is denied but coarseLocation is granted, which is enough.
    if (permission.location === "denied" && permission.coarseLocation !== "granted") {
      return { ok: false, reason: "denied" };
    }
  } catch (error) {
    return { ok: false, reason: nativeFailure(error) };
  }
  const attempt = async (options: PositionOptions): Promise<LocateResult> => {
    try {
      const { coords } = await Geolocation.getCurrentPosition(options);
      return { ok: true, position: toPosition(coords) };
    } catch (error) {
      return { ok: false, reason: nativeFailure(error) };
    }
  };
  const first = await attempt(QUICK);
  return retryable(first) ? attempt(PRECISE) : first;
}

/** Error codes of @capacitor/geolocation (README → Errors). */
const NATIVE_CODES: Record<string, LocateFailure> = {
  "OS-PLUG-GLOC-0003": "denied",
  "OS-PLUG-GLOC-0008": "denied",
  "OS-PLUG-GLOC-0007": "off",
  "OS-PLUG-GLOC-0009": "off",
  "OS-PLUG-GLOC-0017": "off",
  "OS-PLUG-GLOC-0010": "timeout",
};

export function nativeFailure(error: unknown): LocateFailure {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return NATIVE_CODES[code] ?? "unavailable";
}

const BROWSER_CODES: Record<number, LocateFailure> = { 1: "denied", 2: "unavailable", 3: "timeout" };

async function locateInBrowser(): Promise<LocateResult> {
  if (typeof window !== "undefined" && window.isSecureContext === false) return { ok: false, reason: "insecure" };
  const geolocation = typeof navigator === "undefined" ? undefined : navigator.geolocation;
  if (!geolocation) return { ok: false, reason: "unsupported" };
  const attempt = (options: PositionOptions) =>
    new Promise<LocateResult>((resolve) => {
      geolocation.getCurrentPosition(
        ({ coords }) => resolve({ ok: true, position: toPosition(coords) }),
        (error) => resolve({ ok: false, reason: BROWSER_CODES[error.code] ?? "unavailable" }),
        options,
      );
    });
  const first = await attempt(QUICK);
  return retryable(first) ? attempt(PRECISE) : first;
}

function toPosition(coords: { latitude: number; longitude: number; accuracy: number }): DevicePosition {
  return { latitude: coords.latitude, longitude: coords.longitude, accuracyMeters: Math.round(coords.accuracy) };
}

/** Watching while walking: GPS, positions at most 5 s old. */
const WATCH = { enableHighAccuracy: true, timeout: 20_000, maximumAge: 5_000 };

type OnPosition = (position: DevicePosition) => void;
type OnFailure = (reason: LocateFailure) => void;

/**
 * Follows the device position (turn-by-turn guidance) until the returned function is called. `onFailure` fires
 * when there is no permission, no Geolocation API or no fix; a watch that already gave positions may keep going.
 */
export function watchDevice(onPosition: OnPosition, onFailure: OnFailure): () => void {
  return Capacitor.isNativePlatform() ? watchNative(onPosition, onFailure) : watchInBrowser(onPosition, onFailure);
}

function watchNative(onPosition: OnPosition, onFailure: OnFailure): () => void {
  let stopped = false;
  let clear = () => {};
  void (async () => {
    const { Geolocation } = await import("@capacitor/geolocation");
    try {
      const permission = await Geolocation.requestPermissions({ permissions: ["location"] });
      if (permission.location === "denied" && permission.coarseLocation !== "granted") return onFailure("denied");
      if (stopped) return;
      const id = await Geolocation.watchPosition(WATCH, (position, error) => {
        if (stopped) return;
        if (position) onPosition(toPosition(position.coords));
        else if (error) onFailure("unavailable");
      });
      clear = () => void Geolocation.clearWatch({ id });
      if (stopped) clear();
    } catch {
      // Thrown when location services are off.
      if (!stopped) onFailure("unavailable");
    }
  })();
  return () => {
    stopped = true;
    clear();
  };
}

function watchInBrowser(onPosition: OnPosition, onFailure: OnFailure): () => void {
  const geolocation = typeof navigator === "undefined" ? undefined : navigator.geolocation;
  if (!geolocation) {
    onFailure("unsupported");
    return () => {};
  }
  const id = geolocation.watchPosition(
    ({ coords }) => onPosition(toPosition(coords)),
    (error) => onFailure(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"),
    WATCH,
  );
  return () => geolocation.clearWatch(id);
}
