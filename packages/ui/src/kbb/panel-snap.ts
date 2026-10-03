/** Speed (px/ms) above which a released swipe moves on to the next state in its direction. */
export const FLICK_VELOCITY = 0.4;
/** Movement (px) a pointer needs before a press on the grabber row turns into a swipe. */
export const DRAG_SLOP = 8;

/**
 * Index of the state a released swipe settles on.
 * @param heights state heights in px, ascending
 * @param height the panel height at release
 * @param velocity growth speed in px/ms at release (positive = the panel grows)
 */
export function snapPanel(heights: readonly number[], height: number, velocity: number): number {
  if (heights.length === 0) throw new Error("snapPanel needs at least one state");
  const last = heights.length - 1;
  if (velocity > FLICK_VELOCITY) {
    const next = heights.findIndex((h) => h > height + 1);
    return next === -1 ? last : next;
  }
  if (velocity < -FLICK_VELOCITY) {
    const below = heights.findLastIndex((h) => h < height - 1);
    return below === -1 ? 0 : below;
  }
  let nearest = 0;
  heights.forEach((h, i) => {
    if (Math.abs(h - height) < Math.abs(heights[nearest]! - height)) nearest = i;
  });
  return nearest;
}

type Sample = { t: number; y: number };

/** Growth speed in px/ms over the last `window` ms of pointer samples (y grows downwards, so a rising finger is positive). */
export function releaseVelocity(samples: readonly Sample[], window = 100): number {
  const end = samples.at(-1);
  if (!end) return 0;
  const start = samples.find((s) => end.t - s.t <= window) ?? end;
  const dt = end.t - start.t;
  return dt > 0 ? (start.y - end.y) / dt : 0;
}
