"use client";

import { useEffect, useState } from "react";

export interface ViewportSize {
  innerHeight: number;
  height: number;
  offsetTop: number;
  scale: number;
}

/**
 * How far the bottom of the visible area sits above the bottom of the layout viewport — the
 * keyboard, plus however far iOS panned to show the focused field — or `null` when the visual
 * viewport is pinch-zoomed: a zoomed viewport is smaller too, but nothing covers the sheet.
 */
export function keyboardInset({ innerHeight, height, offsetTop, scale }: ViewportSize): number | null {
  if (Math.abs(scale - 1) > 0.01) return null;
  return Math.max(0, Math.round(innerHeight - height - offsetTop));
}

/** Px for a bottom sheet to sit above the keyboard; unchanged while the page is pinch-zoomed. */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const next = keyboardInset({
        innerHeight: window.innerHeight,
        height: viewport.height,
        offsetTop: viewport.offsetTop,
        scale: viewport.scale,
      });
      if (next !== null) setInset(next);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}
