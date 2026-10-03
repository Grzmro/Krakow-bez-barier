"use client";

import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";
import { locateDevice } from "@/lib/native/geolocation";
import type { NearbyOrigin } from "@/lib/nearby";

/**
 * The device position for the start peek, only when the browser already granted location: it never opens a
 * permission prompt on its own. `null` otherwise (no permission, native app, no Permissions API, no fix).
 */
export function useGrantedPosition(): NearbyOrigin | null {
  const [origin, setOrigin] = useState<NearbyOrigin | null>(null);
  useEffect(() => {
    if (Capacitor.isNativePlatform() || typeof navigator === "undefined" || !navigator.permissions?.query) return;
    let cancelled = false;
    navigator.permissions
      .query({ name: "geolocation" })
      .then(async ({ state }) => {
        if (state !== "granted") return;
        const result = await locateDevice();
        if (!cancelled && result.ok) setOrigin({ position: result.position });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return origin;
}
