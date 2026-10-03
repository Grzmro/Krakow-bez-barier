import { Capacitor } from "@capacitor/core";

export type AppPlatform = "ios" | "android" | "web";

export function appPlatform(): AppPlatform {
  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "android" ? platform : "web";
}
