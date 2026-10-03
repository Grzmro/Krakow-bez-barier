import type { Messages } from "../messages";

export const nearby: Messages["nearby"] = {
  action: "Near me",
  actionSub: "Find my position",
  locating: "Finding your position…",
  found: (latitude: string, longitude: string, accuracy: number) =>
    `You are here: ${latitude}° N, ${longitude}° E (accuracy ±${accuracy} m)`,
  privacy: "Your position stays on your device — we don't send it to the server.",
  errors: {
    denied: "No permission to use location. You can turn it on in your device settings.",
    unavailable: "Couldn't find your position. Check that location services are on and try again.",
    unsupported: "This device doesn't provide location.",
  },
  home: {
    sortOff: "Show nearest places first",
    sortOn: "Nearest first, distance from you",
    privacy:
      "Your exact position stays on the device. For the search we send only an approximate area within about 2 km, not your position.",
    announce: "Near you, nearest first",
    you: "You",
    emptyHint: "You're searching only near you (within about 2 km).",
    truncated: (shown: number, total: number) =>
      `The list covers ${shown} of ${total} matching places nearby, so the nearest ones may be missing. Narrow the search with a name, category or filter.`,
  },
  devPage: {
    title: "Native features",
    lead: "Mobile app diagnostics: which platform the page runs on and whether location works. The position is requested right after opening.",
    platform: "Platform",
    platforms: { ios: "iOS app", android: "Android app", web: "browser" },
  },
};
