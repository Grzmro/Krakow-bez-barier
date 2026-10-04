/** Delay between the last keystroke and the search it triggers. */
export const SEARCH_DEBOUNCE_MS = 300;

export interface Debouncer<T> {
  /** Schedules `value`; a newer one replaces it before it is emitted. */
  push: (value: T) => void;
  /** Emits the pending value at once (Enter), if there is one. */
  flush: () => void;
  /** Drops the pending value. */
  cancel: () => void;
}

/** Emits only the last value of a burst, `delay` ms after it; `flush` skips the wait. */
export function createDebouncer<T>(delay: number, emit: (value: T) => void): Debouncer<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { value: T } | null = null;
  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    pending = null;
  };
  const flush = () => {
    const next = pending;
    cancel();
    if (next) emit(next.value);
  };
  return {
    push(value) {
      clearTimeout(timer);
      pending = { value };
      timer = setTimeout(flush, delay);
    },
    flush,
    cancel,
  };
}
