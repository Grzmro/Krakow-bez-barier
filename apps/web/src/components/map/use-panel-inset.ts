"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { panelInset } from "../home/map-padding";

// Waits for the panel to stop moving (a swipe, the height transition) before the map's padding follows it.
const SETTLE_MS = 120;

/** The attribution and zoom buttons ride just above the panel (never above its half height). */
export const CONTROLS_ABOVE_PANEL = "bottom-[calc(var(--panel-inset,0px)+0.75rem)] lg:bottom-9";

/** Height of a `BottomPanel` stowed to its bar; the panel pads its own content by the bottom safe area. */
export const STOWED_HEIGHT = "calc(4.5rem + env(safe-area-inset-bottom))";

/**
 * How much of a full-screen map a `BottomPanel` lying over it covers. Pass `follow` as the panel's
 * `onHeightChange`: every frame of a swipe or transition it writes `--panel-inset` on `rootRef` (the map
 * controls follow at once, with no render); the returned `inset` (the map's padding) follows once the panel
 * has settled. `collapsedRef` is a probe as tall as the panel's half height, hidden where the panel is a
 * column beside the map.
 */
export function usePanelInset(rootRef: RefObject<HTMLElement | null>, collapsedRef: RefObject<HTMLElement | null>) {
  const [inset, setInset] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const known = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);

  const follow = useCallback(
    (height: number) => {
      const root = rootRef.current;
      const probe = collapsedRef.current;
      if (!root || !probe) return;
      const collapsed = probe.getClientRects().length ? probe.getBoundingClientRect().height : 0;
      const next = panelInset(height, collapsed);
      root.style.setProperty("--panel-inset", `${next}px`);
      clearTimeout(timer.current);
      // The first height is taken at once: the map fits to it as soon as it loads.
      if (!known.current) {
        known.current = true;
        setInset(next);
      } else timer.current = setTimeout(() => setInset(next), SETTLE_MS);
    },
    [rootRef, collapsedRef],
  );

  return { inset, follow };
}
