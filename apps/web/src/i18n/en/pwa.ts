import type { Messages } from "../messages";

export const pwa: Messages["pwa"] = {
  shortName: "Bez barier",
  offline: {
    withDate: (date: string) => `You're offline — showing data from ${date}.`,
    noCopy: "You're offline.",
  },
  offlinePage: {
    title: "You're offline",
    lead: "This page isn't stored on your device yet. Connect to the internet or go back to the home page — we'll show the most recently saved data.",
    home: "Home page",
  },
  install: {
    label: "Install the app",
    button: "Install the app",
    lead: "Add Kraków bez barier to your home screen — it works without the internet too.",
    ios: "On iPhone: tap Share, then “Add to Home Screen”.",
    dismiss: "Not now",
  },
};
