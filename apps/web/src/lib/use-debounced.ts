"use client";

import { useEffect, useRef, useState } from "react";
import { createDebouncer, type Debouncer, SEARCH_DEBOUNCE_MS } from "./debounce";

/**
 * `value` once it has stopped changing for `delay` ms: typing becomes one query, not one per keystroke.
 * `flush` makes the current value count now (Enter).
 */
export function useDebouncedValue<T>(value: T, delay = SEARCH_DEBOUNCE_MS): { value: T; flush: () => void } {
  const [debounced, setDebounced] = useState(value);
  const latest = useRef(value);
  const debouncer = useRef<Debouncer<T> | null>(null);
  useEffect(() => {
    const d = createDebouncer<T>(delay, setDebounced);
    debouncer.current = d;
    return d.cancel;
  }, [delay]);
  useEffect(() => {
    latest.current = value;
    debouncer.current?.push(value);
  }, [value]);
  return {
    value: debounced,
    flush: () => {
      debouncer.current?.cancel();
      setDebounced(latest.current);
    },
  };
}

export function useDebounced<T>(value: T, delay = SEARCH_DEBOUNCE_MS): T {
  return useDebouncedValue(value, delay).value;
}
