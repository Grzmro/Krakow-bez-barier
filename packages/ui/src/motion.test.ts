import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MOTION, motionMs, reducedMotion } from "./motion";

const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

function stubBrowser({ attribute, systemReduce }: { attribute: string | null; systemReduce: boolean }) {
  vi.stubGlobal("window", { matchMedia: (query: string) => ({ matches: systemReduce && query.includes("reduce") }) });
  vi.stubGlobal("document", { documentElement: { getAttribute: () => attribute } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("motion tokens", () => {
  it("CSS durations and MOTION are the same numbers", () => {
    // GIVEN the --duration-* custom properties of styles.css
    const durations = Object.fromEntries([...css.matchAll(/--duration-(\w+):\s*(\d+)ms;/g)].map((m) => [m[1], Number(m[2])]));

    // THEN each one matches its MOTION twin, and there is no token on one side only
    expect(durations).toEqual(MOTION);
  });
});

describe("reducedMotion", () => {
  it("is off when neither the system nor the visitor asks for less motion", () => {
    // GIVEN no system preference and no "Mniej animacji"
    stubBrowser({ attribute: null, systemReduce: false });

    // THEN motion plays at its full length
    expect(reducedMotion()).toBe(false);
    expect(motionMs(MOTION.camera)).toBe(400);
  });

  it("follows the system's prefers-reduced-motion", () => {
    // GIVEN the system asks for reduced motion
    stubBrowser({ attribute: null, systemReduce: true });

    // THEN moves become instant
    expect(reducedMotion()).toBe(true);
    expect(motionMs(MOTION.camera)).toBe(0);
  });

  it("follows the visitor's 'Mniej animacji' even when the system doesn't ask", () => {
    // GIVEN <html data-motion="reduce"> and no system preference
    stubBrowser({ attribute: "reduce", systemReduce: false });

    // THEN moves become instant
    expect(reducedMotion()).toBe(true);
    expect(motionMs(MOTION.sheet)).toBe(0);
  });

  it("is off on the server", () => {
    // GIVEN no window (server render)
    // THEN nothing is reduced and nothing throws
    expect(reducedMotion()).toBe(false);
  });
});
