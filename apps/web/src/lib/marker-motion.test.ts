import { describe, expect, it } from "vitest";
import { MARKER_MOTION, markerTransition } from "./marker-motion";

describe("marker transitions", () => {
  it("flies an entering child from its cluster to its place, growing and fading in", () => {
    // GIVEN a pin entering 40 px right and 10 px below its cluster
    // WHEN its transition is built
    const { keyframes, options } = markerTransition("enter", [-40, -10], false);

    // THEN it starts small and transparent on the cluster and ends at its own place
    expect(keyframes[0]).toEqual({ opacity: 0, transform: "translate(-40px, -10px) scale(0.5)" });
    expect(keyframes.at(-1)).toEqual({ opacity: 1, transform: "translate(0px, 0px) scale(1)" });
    expect(options.duration).toBe(MARKER_MOTION.fly);
  });

  it("flies a leaving child into the cluster that merges it and keeps it hidden until removed", () => {
    // GIVEN a pin merging into a cluster 20 px to its left
    // WHEN its transition is built
    const { keyframes, options } = markerTransition("leave", [-20, 0], false);

    // THEN it ends on the cluster, small and transparent
    expect(keyframes.at(-1)).toEqual({ opacity: 0, transform: "translate(-20px, 0px) scale(0.5)" });
    expect(options.fill).toBe("forwards");
  });

  it("scales and fades a marker without a partner in place, quicker than a flight", () => {
    // GIVEN a cluster fading out while its children fly out of it
    // WHEN its transition is built
    const { keyframes, options } = markerTransition("leave", null, false);

    // THEN it doesn't move, only shrinks and fades
    expect(keyframes.at(-1)).toEqual({ opacity: 0, transform: "scale(0.7)" });
    expect(keyframes.at(-1)?.transform).not.toContain("translate");
    expect(options.duration).toBeLessThan(MARKER_MOTION.fly);
  });

  it("only fades when the visitor asked for less motion: nothing flies or scales", () => {
    // GIVEN less motion asked for
    // WHEN a flight in and a flight out are built
    const enter = markerTransition("enter", [-40, -10], true);
    const leave = markerTransition("leave", [20, 0], true);

    // THEN both are opacity alone, and short
    for (const { keyframes, options } of [enter, leave]) {
      expect(keyframes.every((frame) => !("transform" in frame))).toBe(true);
      expect(options.duration).toBe(MARKER_MOTION.reducedFade);
    }
  });
});
