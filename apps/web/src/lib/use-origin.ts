"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/** The page's own origin, so shared links work wherever the app is deployed; empty during SSR. */
export function useOrigin() {
  return useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => "",
  );
}
