/**
 * A typed number for a stepper: comma or dot decimals, clamped to the range. `null` when the text is empty or not a
 * number, so the field falls back to the current value instead of jumping to 0.
 */
export function clampStep(raw: string, { min, max }: { min: number; max: number }): number | null {
  const text = raw.trim().replace(",", ".");
  if (text === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}
