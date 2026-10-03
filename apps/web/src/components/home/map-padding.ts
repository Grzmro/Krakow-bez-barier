export type VerticalPadding = { top: number; bottom: number };

/**
 * Shrinks the overlay padding of a short map (a phone with banners and the half-height list) so the
 * places keep at least `1 - maxShare` of the height instead of being squeezed into a line.
 */
export function fitPadding(padding: VerticalPadding, height: number, maxShare = 0.6): VerticalPadding {
  const total = padding.top + padding.bottom;
  if (total <= 0 || height <= 0) return padding;
  const scale = Math.min(1, (maxShare * height) / total);
  return { top: Math.round(padding.top * scale), bottom: Math.round(padding.bottom * scale) };
}
