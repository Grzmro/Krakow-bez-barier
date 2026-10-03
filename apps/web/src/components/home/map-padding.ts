export type VerticalPadding = { top: number; bottom: number };
export type Padding = VerticalPadding & { left: number; right: number };

/**
 * Shrinks the overlay padding of a short map (a phone with the half-height list) so the
 * places keep at least `1 - maxShare` of the height instead of being squeezed into a line.
 */
export function fitPadding(padding: VerticalPadding, height: number, maxShare = 0.6): VerticalPadding {
  const total = padding.top + padding.bottom;
  if (total <= 0 || height <= 0) return padding;
  const scale = Math.min(1, (maxShare * height) / total);
  return { top: Math.round(padding.top * scale), bottom: Math.round(padding.bottom * scale) };
}

/**
 * Padding of a full-height map whose bottom `inset` px are covered by a panel: the overlays are fitted
 * into the part above the panel, and the panel itself is added to the bottom.
 */
export function mapPadding(overlays: VerticalPadding, inset: number, height: number): Padding {
  const covered = Math.max(0, Math.min(inset, height));
  const fitted = fitPadding(overlays, height - covered);
  return { top: fitted.top, bottom: covered + fitted.bottom, left: 0, right: 0 };
}

/** Whether a screen point of a `width` × `height` map lies in its visible area, clear of the padding. */
export function insidePadding(point: { x: number; y: number }, width: number, height: number, padding: Padding): boolean {
  return point.x >= padding.left && point.x <= width - padding.right && point.y >= padding.top && point.y <= height - padding.bottom;
}

/** The centre of the area left by the padding, where MapLibre draws the map's centre. */
export function paddedCentre(width: number, height: number, padding: Padding): [number, number] {
  return [(padding.left + width - padding.right) / 2, (padding.top + height - padding.bottom) / 2];
}
