import { EASING, MOTION } from "@krakow-bez-barier/ui";

/** Durations (ms) of the map markers' transitions, from the motion tokens. */
export const MARKER_MOTION = { fly: MOTION.slow, fade: MOTION.base, reducedFade: MOTION.fast } as const;

const EASE_OUT = EASING.out;
const EASE_IN_OUT = EASING.inOut;
const FROM_SCALE = 0.5;

export type MarkerTransition = { keyframes: Keyframe[]; options: KeyframeAnimationOptions };

/**
 * Keyframes of a marker entering or leaving the map. `offset` (px) is where its partner stands relative to
 * it: an entering child starts there and flies out, a leaving child ends there and merges in. Without a
 * partner it scales and fades in place. With less motion asked for nothing moves or scales, it only fades.
 */
export function markerTransition(
  direction: "enter" | "leave",
  offset: [number, number] | null,
  reduced: boolean,
): MarkerTransition {
  const away: Keyframe = reduced
    ? { opacity: 0 }
    : {
        opacity: 0,
        transform: offset ? `translate(${offset[0]}px, ${offset[1]}px) scale(${FROM_SCALE})` : `scale(${FROM_SCALE + 0.2})`,
      };
  const here: Keyframe = reduced ? { opacity: 1 } : { opacity: 1, transform: "translate(0px, 0px) scale(1)" };
  const duration = reduced ? MARKER_MOTION.reducedFade : offset ? MARKER_MOTION.fly : MARKER_MOTION.fade;
  return direction === "enter"
    ? { keyframes: [away, here], options: { duration, easing: EASE_OUT, fill: "backwards" } }
    : { keyframes: [here, away], options: { duration, easing: offset ? EASE_IN_OUT : EASE_OUT, fill: "forwards" } };
}
