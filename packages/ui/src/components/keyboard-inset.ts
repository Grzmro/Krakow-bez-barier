"use client";

import { useEffect, useState } from "react";

export interface ViewportSize {
  innerHeight: number;
  height: number;
  scale: number;
}

/**
 * How far the on-screen keyboard covers the bottom of the layout viewport, or `null` when the
 * visual viewport is pinch-zoomed: a zoomed viewport is smaller too, but nothing covers the sheet.
 */
export function keyboardInset({ innerHeight, height, scale }: ViewportSize): number | null {
  if (Math.abs(scale - 1) > 0.01) return null;
  return Math.max(0, Math.round(innerHeight - height));
}

/** Keyboard height in px for a bottom sheet to sit above; unchanged while the page is pinch-zoomed. */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const next = keyboardInset({ innerHeight: window.innerHeight, height: viewport.height, scale: viewport.scale });
      if (next !== null) setInset(next);
    };
    update();
    viewport.addEventListener("resize", update);
    return () => viewport.removeEventListener("resize", update);
  }, []);
  return inset;
}
