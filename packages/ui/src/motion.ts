/**
 * Motion tokens (ms) for code that animates outside CSS, e.g. MapLibre camera moves. The same values are
 * the `--duration-*` custom properties in `styles.css` (a test keeps them equal).
 */
export const MOTION = {
  /** Press feedback, colour and ring changes. */
  fast: 120,
  /** Fades, crossfades, expanding a row. */
  base: 200,
  /** Content entering: list rows, a new guidance step. */
  slow: 300,
  /** Map camera: fits, eases to a place or a cluster. */
  camera: 400,
  /** Sheets: the bottom panel and Vaul drawers (Vaul's own built-in duration). */
  sheet: 500,
} as const;

/** The `--ease-out` / `--ease-in-out` curves of `styles.css`, for the Web Animations API (a test keeps them equal). */
export const EASING = {
  out: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
} as const;

/** `<html data-motion="reduce">`: the visitor turned on "Mniej animacji" (KBB-92), whatever the system says. */
export const MOTION_ATTRIBUTE = "data-motion";

/** Whether to skip motion: the system asks for reduced motion, or the visitor chose "Mniej animacji". */
export function reducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.getAttribute(MOTION_ATTRIBUTE) === "reduce") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** `ms`, or 0 (an instant change) when motion is reduced. */
export function motionMs(ms: number): number {
  return reducedMotion() ? 0 : ms;
}
