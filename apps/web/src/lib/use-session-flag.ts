import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const memory = new Map<string, boolean>();

function read(key: string) {
  const known = memory.get(key);
  if (known !== undefined) return known;
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/** A boolean kept in `sessionStorage` (this tab's session); false on the server and when storage is blocked. */
export function useSessionFlag(key: string): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
    () => read(key),
    () => false,
  );
  const set = useCallback(
    (next: boolean) => {
      memory.set(key, next);
      try {
        if (next) sessionStorage.setItem(key, "1");
        else sessionStorage.removeItem(key);
      } catch {
        // Storage blocked: the in-memory value still holds for this page load.
      }
      listeners.forEach((listener) => listener());
    },
    [key],
  );
  return [value, set];
}
