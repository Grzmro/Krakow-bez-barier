import { describe, expect, it } from "vitest";
import { installOffer, type InstallContext } from "./install-offer";

const BROWSER: InstallContext = { native: false, standalone: false, ios: false, canPrompt: false };

describe("installOffer", () => {
  it.each([
    ["the native iOS app", { native: true, ios: true }],
    ["the native Android app with a prompt event", { native: true, canPrompt: true }],
    ["an installed PWA on iOS", { standalone: true, ios: true }],
    ["an installed PWA with a prompt event", { standalone: true, canPrompt: true }],
  ])("offers nothing in %s", (_, overrides) => {
    // GIVEN the app already runs installed
    // WHEN deciding what the install banner shows
    const offer = installOffer({ ...BROWSER, ...overrides });

    // THEN there is no banner
    expect(offer).toBeNull();
  });

  it("offers the install button when the browser can prompt", () => {
    // GIVEN a browser that fired beforeinstallprompt
    // WHEN deciding what the install banner shows
    // THEN it is the install button
    expect(installOffer({ ...BROWSER, canPrompt: true })).toBe("button");
  });

  it("offers the Add to Home Screen hint in Safari on iOS", () => {
    // GIVEN iOS in the browser, which has no install prompt
    // WHEN deciding what the install banner shows
    // THEN it is the manual hint
    expect(installOffer({ ...BROWSER, ios: true })).toBe("ios-hint");
  });

  it("offers nothing in a desktop browser without a prompt event", () => {
    // GIVEN a browser that can't install the app
    // WHEN / THEN there is no banner
    expect(installOffer(BROWSER)).toBeNull();
  });
});
