"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Route } from "@krakow-bez-barier/contracts";
import { watchDevice, type DevicePosition, type LocateFailure } from "./native/geolocation";
import { atStepStart, locate, type Progress } from "./navigation";
import { toLonLat } from "./nearby";

/** `locating` until the first fix; `located` follows the device; `manual` = no position, steps by the buttons. */
export type GuidanceMode = "locating" | "located" | "manual";

export type Guidance = {
  active: boolean;
  mode: GuidanceMode;
  failure: LocateFailure | null;
  /** `[lon, lat]` of the device; it never leaves the device, except when the walker asks to plan again from it. */
  position: [number, number] | null;
  progress: Progress | null;
  follow: boolean;
  setFollow: (follow: boolean) => void;
  start: () => void;
  end: () => void;
  previous: () => void;
  next: () => void;
};

/** Turn-by-turn guidance along `route`: the device position while active, and the step it puts the walker on. */
export function useGuidance(route: Route | undefined): Guidance {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [device, setDevice] = useState<DevicePosition | null>(null);
  const [failure, setFailure] = useState<LocateFailure | null>(null);
  const [follow, setFollow] = useState(true);
  const [guided, setGuided] = useState(route);
  const routeRef = useRef(route);
  const stepRef = useRef(step);
  useEffect(() => {
    routeRef.current = route;
    stepRef.current = step;
  });

  // A new route (planned again from here, another kind) starts from its first step.
  if (guided !== route) {
    setGuided(route);
    setStep(0);
  }

  useEffect(() => {
    if (!active) return;
    return watchDevice(
      (position) => {
        setDevice(position);
        const current = routeRef.current;
        if (!current) return;
        const next = locate(current, toLonLat(position), stepRef.current).step;
        if (next === stepRef.current) return;
        stepRef.current = next;
        setStep(next);
      },
      setFailure,
    );
  }, [active]);

  const position = device ? toLonLat(device) : null;
  const mode: GuidanceMode = position ? "located" : failure ? "manual" : "locating";
  const progress = route ? (position ? locate(route, position, step) : atStepStart(route, step)) : null;
  const last = route ? route.segments.length - 1 : 0;

  return {
    active,
    mode,
    failure,
    position,
    progress,
    follow,
    setFollow,
    start: useCallback(() => {
      setStep(0);
      setDevice(null);
      setFailure(null);
      setFollow(true);
      setActive(true);
    }, []),
    end: useCallback(() => {
      setActive(false);
      setDevice(null);
    }, []),
    previous: () => setStep((s) => Math.max(0, s - 1)),
    next: () => setStep((s) => Math.min(last, s + 1)),
  };
}
