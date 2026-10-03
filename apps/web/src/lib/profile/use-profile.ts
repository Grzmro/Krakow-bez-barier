"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Profile } from "@krakow-bez-barier/contracts";
import { DEFAULT_SETTINGS, DEFAULT_THRESHOLDS, parseSettings, type ProfileSettings, type Thresholds } from "./thresholds";

// The profile lives only in this browser (R4, privacy): localStorage, never sent anywhere except as
// plain query parameters of the requests it shapes.
const STORAGE_KEY = "kbb.profile.v1";

const listeners = new Set<() => void>();
let cache: { raw: string | null; settings: ProfileSettings } = { raw: null, settings: DEFAULT_SETTINGS };

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return cache.raw;
  }
}

function getSnapshot(): ProfileSettings {
  const raw = readRaw();
  if (raw !== cache.raw) cache = { raw, settings: parseSettings(raw) };
  return cache.settings;
}

const getServerSnapshot = () => DEFAULT_SETTINGS;

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function write(settings: ProfileSettings) {
  const raw = JSON.stringify(settings);
  cache = { raw, settings };
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Storage blocked (private mode): the profile still works for this page view.
  }
  listeners.forEach((listener) => listener());
}

/** The user's needs profile and thresholds, shared by every screen and persisted in the browser. */
export function useProfile() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setProfile = useCallback((profile: Profile | null) => write({ ...getSnapshot(), profile }), []);

  const setThresholds = useCallback((profile: Profile, thresholds: Thresholds) => {
    const current = getSnapshot();
    write({ ...current, thresholds: { ...current.thresholds, [profile]: thresholds } });
  }, []);

  const resetThresholds = useCallback((profile: Profile) => {
    const current = getSnapshot();
    write({ ...current, thresholds: { ...current.thresholds, [profile]: DEFAULT_THRESHOLDS[profile] } });
  }, []);

  return { settings, setProfile, setThresholds, resetThresholds };
}
