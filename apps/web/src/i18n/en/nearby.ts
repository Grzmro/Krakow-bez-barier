import type { Messages } from "../messages";

export const nearby: Messages["nearby"] = {
  action: "Near me",
  actionSub: "Find my position",
  locating: "Finding your position…",
  found: (latitude: string, longitude: string, accuracy: number) =>
    `You are here: ${latitude}° N, ${longitude}° E (accuracy ±${accuracy} m)`,
  privacy: "Your position stays on your device — we don't send it to the server.",
  errors: {
    denied: "No permission to use location.",
    off: "Location services are off.",
    unavailable: "Your phone doesn't know its position right now.",
    timeout: "Finding your position took too long.",
    insecure: "Location only works over a secure connection (https).",
    unsupported: "This device doesn't provide location.",
  },
  help: {
    denied: {
      ios: "On iPhone or iPad: Settings → Privacy & Security → Location Services → Safari Websites → “While Using the App” (in Chrome or Firefox: Settings → Chrome/Firefox → Location). Then come back and try again.",
      "ios-app": "Settings → Kraków bez barier → Location → “While Using the App”. Then come back and try again.",
      android:
        "On Android: in Chrome tap the icon next to the address (in the installed app, long-press its icon → App info) → Permissions → Location → Allow. Then try again.",
      "android-app": "Settings → Apps → Kraków bez barier → Permissions → Location → “Allow only while using the app”. Then try again.",
      other: "Allow location in the site settings (the icon next to the address) and try again.",
    },
    off: {
      ios: "Turn them on: Settings → Privacy & Security → Location Services. Then try again.",
      "ios-app": "Turn them on: Settings → Privacy & Security → Location Services. Then try again.",
      android: "Turn on Location in quick settings (swipe down from the top of the screen) and try again.",
      "android-app": "Turn on Location in quick settings (swipe down from the top of the screen) and try again.",
      other: "Turn on location in the system settings and try again.",
    },
    unavailable: "Check that location is on, move closer to a window or step outside, and try again.",
    timeout: "Try again — with a good signal it takes a few seconds.",
    insecure: "Open the app at an address starting with https://.",
  },
  retry: "Try again",
  manual: {
    open: "Or choose a district",
    label: "District",
    placeholder: "Choose a district…",
    submit: "Show area",
  },
  home: {
    sortOff: "Show nearest places first",
    sortOn: "Nearest first, distance from you",
    sortOnChosen: (place: string) => `Nearest first, distance from: ${place}`,
    privacy:
      "Your exact position stays on the device. For the search we send only an approximate area within about 2 km, not your position.",
    announce: "Near you, nearest first",
    announceChosen: (place: string) => `Near ${place}, nearest first`,
    you: "You",
    emptyHint: "You're searching only near you (within about 2 km).",
    emptyHintChosen: (place: string) => `You're searching only near ${place} (within about 2 km).`,
    nearestOnly: (shown: number, total: number) =>
      `Showing the ${shown} nearest of ${total} places nearby. Narrow the search with a name, category or filter to see the rest.`,
    nearestRynekOnly: (shown: number, total: number) =>
      `Showing the ${shown} nearest the Main Square of ${total} places. Narrow the search with a name, category or filter, or use “Near me”.`,
  },
  devPage: {
    title: "Native features",
    lead: "Mobile app diagnostics: which platform the page runs on and whether location works. The position is requested right after opening.",
    platform: "Platform",
    platforms: { ios: "iOS app", android: "Android app", web: "browser" },
  },
};
