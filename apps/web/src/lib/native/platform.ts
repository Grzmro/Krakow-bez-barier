import { Capacitor } from "@capacitor/core";

export type AppPlatform = "ios" | "android" | "web";

export function appPlatform(): AppPlatform {
  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "android" ? platform : "web";
}

/** Where the user changes location settings: the native app's own settings, or the browser's on that OS. */
export type LocationSettings = "ios-app" | "android-app" | "ios" | "android" | "other";

export function locationSettings(): LocationSettings {
  const platform = appPlatform();
  if (platform !== "web") return `${platform}-app`;
  if (typeof navigator === "undefined") return "other";
  const { userAgent, maxTouchPoints } = navigator;
  // iPadOS reports itself as a Mac; touch points tell them apart.
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return "ios";
  if (/Android/.test(userAgent)) return "android";
  return "other";
}
