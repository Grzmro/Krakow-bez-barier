/** Rows the place list renders at first and adds per step; the rest wait until the visitor scrolls or asks. */
export const LIST_PAGE = 20;

/** How many rows to render after one more step, never past the list's end. */
export function nextWindow(rendered: number, total: number, page = LIST_PAGE): number {
  return Math.min(total, rendered + page);
}

/**
 * How many rows to render so the row at `index` is among them: the current window when it already is,
 * otherwise whole pages up to and including the one that holds it. `index` < 0 (not on the list) keeps the window.
 */
export function windowFor(index: number, rendered: number, page = LIST_PAGE): number {
  if (index < rendered) return rendered;
  return (Math.floor(index / page) + 1) * page;
}
