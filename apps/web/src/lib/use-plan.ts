"use client";

import { useCallback, useSyncExternalStore } from "react";
import { addStop, moveStop, parsePlan, PLAN_STORAGE_KEY, removeStop, type PlanStop } from "./day-plan";

const listeners = new Set<() => void>();
const EMPTY: PlanStop[] = [];
let cache: { raw: string | null; plan: PlanStop[] } = { raw: null, plan: EMPTY };

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(PLAN_STORAGE_KEY);
  } catch {
    return cache.raw;
  }
}

function getSnapshot(): PlanStop[] {
  const raw = readRaw();
  if (raw !== cache.raw) cache = { raw, plan: raw ? parsePlan(raw) : EMPTY };
  return cache.plan;
}

const getServerSnapshot = () => EMPTY;

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === PLAN_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function write(plan: PlanStop[]) {
  const raw = JSON.stringify(plan);
  cache = { raw, plan };
  try {
    window.localStorage.setItem(PLAN_STORAGE_KEY, raw);
  } catch {
    // Storage blocked (private mode): the plan still works for this page view.
  }
  listeners.forEach((listener) => listener());
}

/** The day plan kept in this browser, shared by the place card and the plan screen. */
export function usePlan() {
  const plan = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const add = useCallback((stop: PlanStop) => write(addStop(getSnapshot(), stop)), []);
  const remove = useCallback((id: string) => write(removeStop(getSnapshot(), id)), []);
  const move = useCallback((index: number, delta: -1 | 1) => write(moveStop(getSnapshot(), index, delta)), []);
  const clear = useCallback(() => write([]), []);
  return { plan, add, remove, move, clear };
}
