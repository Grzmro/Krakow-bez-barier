import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDebouncer } from "./debounce";

describe("createDebouncer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("emits once, with the last value, after a burst of keystrokes", () => {
    // GIVEN a debouncer and someone typing "apt" one letter at a time
    const emit = vi.fn();
    const debouncer = createDebouncer<string>(300, emit);
    // WHEN each letter comes 100 ms after the previous one
    for (const text of ["a", "ap", "apt"]) {
      debouncer.push(text);
      vi.advanceTimersByTime(100);
    }
    expect(emit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    // THEN there is one query, for the full text
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith("apt");
  });

  it("emits at once on flush (Enter) and not again when the timer would have fired", () => {
    // GIVEN a pending value
    const emit = vi.fn();
    const debouncer = createDebouncer<string>(300, emit);
    debouncer.push("muzeum");
    // WHEN Enter flushes it
    debouncer.flush();
    // THEN it is emitted immediately, and only once
    expect(emit).toHaveBeenCalledWith("muzeum");
    vi.advanceTimersByTime(1000);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it("does nothing on flush with nothing pending, and drops the value on cancel", () => {
    // GIVEN a debouncer with a cancelled value
    const emit = vi.fn();
    const debouncer = createDebouncer<string>(300, emit);
    debouncer.flush();
    debouncer.push("x");
    // WHEN it is cancelled
    debouncer.cancel();
    vi.advanceTimersByTime(1000);
    // THEN nothing is emitted
    expect(emit).not.toHaveBeenCalled();
  });
});
