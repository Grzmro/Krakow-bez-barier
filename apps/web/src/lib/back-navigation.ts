// "Back" inside the app: the visible back buttons, the logo on the home screen and the Android back button
// share one notion of where back leads, so none of them leaves the app while there is somewhere to go in it.

const DEPTH_KEY = "kbb-nav-depth";

let depthInMemory: number | null = null;
let popPending = false;
let lastPath: string | null = null;

function readDepth(): number {
  if (depthInMemory !== null) return depthInMemory;
  try {
    return Number(sessionStorage.getItem(DEPTH_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeDepth(depth: number) {
  depthInMemory = depth;
  try {
    sessionStorage.setItem(DEPTH_KEY, String(depth));
  } catch {
    // Storage blocked: the in-memory count still holds for this page load.
  }
}

/** Call on `popstate`: the next page change went back in history (or forward, rare — counted as back). */
export function notePop() {
  popPending = true;
}

/**
 * Call with the path on every page change. The first call is the page load (a reload keeps the tab's
 * count); later ones are in-app navigations, one entry deeper, or one shallower after `notePop`. A repeated
 * path is ignored, so effects that run twice (React Strict Mode) don't count a navigation.
 */
export function notePageChange(path: string) {
  if (path === lastPath) return;
  const first = lastPath === null;
  lastPath = path;
  if (first) {
    popPending = false;
    return;
  }
  writeDepth(popPending ? Math.max(0, readDepth() - 1) : readDepth() + 1);
  popPending = false;
}

/** True when the previous history entry is a page of this app, so `history.back()` stays in it. */
export function hasInAppHistory(): boolean {
  return readDepth() > 0;
}

/** Test only: forget the tracked history. */
export function resetNavigationForTests() {
  depthInMemory = null;
  popPending = false;
  lastPath = null;
  try {
    sessionStorage.removeItem(DEPTH_KEY);
  } catch {
    // ignore
  }
}

/** A screen's own back step (collapse a panel, clear a narrowed view); true when it handled back. */
export type BackHandler = () => boolean;
const handlers: BackHandler[] = [];

export function registerBackHandler(handler: BackHandler): () => void {
  handlers.push(handler);
  return () => {
    const index = handlers.indexOf(handler);
    if (index >= 0) handlers.splice(index, 1);
  };
}

/** Runs the newest handler first; true as soon as one handles back. */
export function runBackHandlers(): boolean {
  return [...handlers].reverse().some((handler) => handler());
}

/**
 * Closes the topmost dialog, drawer or popover the way Escape does. Radix (Vaul) and Base UI both
 * cancel the Escape keydown they dismiss on, so `defaultPrevented` tells whether anything was open.
 */
export function dismissTopLayer(): boolean {
  if (typeof document === "undefined") return false;
  const escape = new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true });
  (document.activeElement ?? document.body).dispatchEvent(escape);
  return escape.defaultPrevented;
}

export type BackStep = "dismissed" | "handled" | "history" | "home" | "exit";

export interface BackEnvironment {
  dismissTopLayer: () => boolean;
  runBackHandlers: () => boolean;
  hasInAppHistory: () => boolean;
  atHome: boolean;
  back: () => void;
  home: () => void;
  exit: () => void;
}

/**
 * The system back button, step by step: close what is open over the page, let the screen undo its own
 * state, go back to the previous page of the app, go up to the home screen, and only then leave the app.
 */
export function systemBack(env: BackEnvironment): BackStep {
  if (env.dismissTopLayer()) return "dismissed";
  if (env.runBackHandlers()) return "handled";
  if (env.hasInAppHistory()) {
    env.back();
    return "history";
  }
  if (!env.atHome) {
    env.home();
    return "home";
  }
  env.exit();
  return "exit";
}

const homeResetListeners = new Set<() => void>();

/** The home screen listens: the logo pressed on it returns the map to its starting view. */
export function onHomeReset(listener: () => void): () => void {
  homeResetListeners.add(listener);
  return () => void homeResetListeners.delete(listener);
}

/** A plain click: not one that opens the link in a new tab or window. */
export const isPlainClick = (event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; button: number }) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

export function requestHomeReset() {
  homeResetListeners.forEach((listener) => listener());
}
