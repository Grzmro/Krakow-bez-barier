"use client";

import { useEffect, useState, type CSSProperties } from "react";

export interface ViewportSize {
  innerHeight: number;
  height: number;
  offsetTop: number;
  scale: number;
}

export interface SheetFit {
  /** Px from the bottom of the layout viewport to the bottom of the visible area (the keyboard). */
  bottom: number;
  /** Px of the visible area: the sheet's ceiling, before the status bar is taken off. */
  visibleHeight: number;
}

/**
 * Where a bottom sheet fits on screen: its bottom on the top of the keyboard, plus however far iOS
 * panned to show the focused field, and its height within the visible area. A web view that shrinks
 * for the keyboard itself (innerHeight shrinks too) gives `bottom: 0`, so the keyboard is never
 * counted twice. `null` while the visual viewport is pinch-zoomed: it is smaller then too, but
 * nothing covers the sheet.
 */
export function sheetFit({ innerHeight, height, offsetTop, scale }: ViewportSize): SheetFit | null {
  if (Math.abs(scale - 1) > 0.01) return null;
  return {
    bottom: Math.max(0, Math.round(innerHeight - height - offsetTop)),
    visibleHeight: Math.floor(height),
  };
}

/**
 * Inline style for a bottom sheet: never taller than the visible area below the status bar, and on
 * the keyboard without the home-indicator padding (the keyboard already covers that strip).
 */
export function sheetStyle(fit: SheetFit | null): CSSProperties | undefined {
  if (!fit) return undefined;
  const maxHeight = `min(92dvh, calc(${fit.visibleHeight}px - env(safe-area-inset-top, 0px) - 0.5rem))`;
  return keyboardOpen(fit) ? { maxHeight, bottom: fit.bottom, paddingBottom: 0 } : { maxHeight };
}

// A keyboard is well over this; a fractional visualViewport height (Android, iOS toolbars) is not.
const MIN_KEYBOARD_PX = 40;

export function keyboardOpen(fit: SheetFit | null): boolean {
  return !!fit && fit.bottom >= MIN_KEYBOARD_PX;
}

/**
 * Scrolls the focused text field back into its sheet's scroll area: iOS reveals the field when the
 * keyboard opens, before the sheet shrinks to fit above it.
 */
export function revealFocusedField(): void {
  const field = document.activeElement;
  if (!(field instanceof HTMLElement) || !field.matches("textarea, select, input:not([type=radio]):not([type=checkbox])")) return;
  for (let el = field.parentElement; el && !el.hasAttribute("data-vaul-drawer"); el = el.parentElement) {
    if (el.scrollHeight <= el.clientHeight || !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) continue;
    const f = field.getBoundingClientRect();
    const s = el.getBoundingClientRect();
    const margin = 12;
    if (f.bottom > s.bottom) el.scrollTop += f.bottom - s.bottom + margin;
    else if (f.top < s.top) el.scrollTop -= s.top - f.top + margin;
    return;
  }
}

/** The current `sheetFit`, kept unchanged while the page is pinch-zoomed; `null` before mount. */
export function useSheetFit(): SheetFit | null {
  const [fit, setFit] = useState<SheetFit | null>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const next = sheetFit({
        innerHeight: window.innerHeight,
        height: viewport.height,
        offsetTop: viewport.offsetTop,
        scale: viewport.scale,
      });
      if (!next) return;
      setFit((prev) =>
        prev && prev.bottom === next.bottom && prev.visibleHeight === next.visibleHeight ? prev : next,
      );
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  return fit;
}
