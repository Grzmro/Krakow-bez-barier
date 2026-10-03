import { Capacitor } from "@capacitor/core";

/**
 * Android's system back button inside the native app. Without a listener Capacitor closes the app on
 * back; with one, `onBack` decides and `exit` sends the app to the background. No-op on iOS and the web,
 * where back is the browser's history.
 */
export function onNativeBack(onBack: (exit: () => void) => void): () => void {
  if (Capacitor.getPlatform() !== "android") return () => {};
  let removed = false;
  let remove: (() => void) | undefined;
  void import("@capacitor/app").then(async ({ App }) => {
    const handle = await App.addListener("backButton", () => onBack(() => void App.minimizeApp()));
    if (removed) void handle.remove();
    else remove = () => void handle.remove();
  });
  return () => {
    removed = true;
    remove?.();
  };
}
