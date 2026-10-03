import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasInAppHistory,
  notePageChange,
  notePop,
  onHomeReset,
  registerBackHandler,
  requestHomeReset,
  resetNavigationForTests,
  runBackHandlers,
  systemBack,
  type BackEnvironment,
} from "./back-navigation";

function env(overrides: Partial<BackEnvironment> = {}): BackEnvironment {
  return {
    dismissTopLayer: () => false,
    runBackHandlers: () => false,
    hasInAppHistory: () => false,
    atHome: false,
    back: vi.fn(),
    home: vi.fn(),
    exit: vi.fn(),
    ...overrides,
  };
}

describe("in-app history", () => {
  beforeEach(resetNavigationForTests);

  it("has no in-app history on the page the visitor landed on", () => {
    // GIVEN a shared link opened in a new tab
    // WHEN the first page renders (twice, as React Strict Mode runs effects)
    notePageChange("/miejsca/sukiennice");
    notePageChange("/miejsca/sukiennice");

    // THEN back would leave the app
    expect(hasInAppHistory()).toBe(false);
  });

  it("counts in-app navigations and the history steps back", () => {
    // GIVEN the home screen, then a place opened from the list
    notePageChange("/");
    notePageChange("/miejsca/sukiennice");
    // THEN back stays in the app
    expect(hasInAppHistory()).toBe(true);

    // WHEN the visitor goes back in history to the home screen
    notePop();
    notePageChange("/");

    // THEN the next back would leave the app
    expect(hasInAppHistory()).toBe(false);
  });

  it("never counts below the landing page", () => {
    // GIVEN the landing page
    notePageChange("/");

    // WHEN a history step happens anyway (e.g. the browser's forward/back past the app)
    notePop();
    notePageChange("/o-danych");

    // THEN there is still no in-app history
    expect(hasInAppHistory()).toBe(false);
  });
});

describe("systemBack", () => {
  it("closes an open drawer before anything else", () => {
    // GIVEN a drawer open over a place with history behind it
    const e = env({ dismissTopLayer: () => true, hasInAppHistory: () => true });

    // WHEN back is pressed THEN only the drawer closes
    expect(systemBack(e)).toBe("dismissed");
    expect(e.back).not.toHaveBeenCalled();
  });

  it("lets the screen undo its own state next", () => {
    // GIVEN the home screen with a narrowed view
    const e = env({ runBackHandlers: () => true, atHome: true });

    // WHEN back is pressed THEN the screen handles it and the app stays open
    expect(systemBack(e)).toBe("handled");
    expect(e.exit).not.toHaveBeenCalled();
  });

  it("goes back to the previous page of the app", () => {
    // GIVEN a place opened from the list
    const e = env({ hasInAppHistory: () => true });

    // WHEN back is pressed THEN history goes back
    expect(systemBack(e)).toBe("history");
    expect(e.back).toHaveBeenCalledOnce();
  });

  it("goes up to the home screen from a page opened by a link", () => {
    // GIVEN a place opened from a shared link (no in-app history)
    const e = env();

    // WHEN back is pressed THEN the home screen opens instead of the app closing
    expect(systemBack(e)).toBe("home");
    expect(e.home).toHaveBeenCalledOnce();
    expect(e.exit).not.toHaveBeenCalled();
  });

  it("leaves the app only from the untouched home screen", () => {
    // GIVEN the home screen in its starting view
    const e = env({ atHome: true });

    // WHEN back is pressed THEN the app exits
    expect(systemBack(e)).toBe("exit");
    expect(e.exit).toHaveBeenCalledOnce();
  });
});

describe("back handlers and home reset", () => {
  it("runs the newest handler first and stops at the one that handles back", () => {
    // GIVEN two screens' handlers, the newer one handling back
    const older = vi.fn(() => true);
    const newer = vi.fn(() => true);
    const removeOlder = registerBackHandler(older);
    const removeNewer = registerBackHandler(newer);

    // WHEN back runs THEN only the newer handler acts
    expect(runBackHandlers()).toBe(true);
    expect(newer).toHaveBeenCalledOnce();
    expect(older).not.toHaveBeenCalled();

    // WHEN both are removed THEN nothing handles back
    removeNewer();
    removeOlder();
    expect(runBackHandlers()).toBe(false);
  });

  it("tells the home screen to reset until it unsubscribes", () => {
    // GIVEN the home screen listening
    const listener = vi.fn();
    const stop = onHomeReset(listener);

    // WHEN the logo asks for a reset THEN the home screen hears it once
    requestHomeReset();
    expect(listener).toHaveBeenCalledOnce();

    // WHEN it has unmounted THEN it hears nothing
    stop();
    requestHomeReset();
    expect(listener).toHaveBeenCalledOnce();
  });
});
