"use client";

import { useEffect, useState } from "react";

/** `value` once it has stopped changing for `delay` ms: typing becomes one query, not one per keystroke. */
export function useDebounced<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
