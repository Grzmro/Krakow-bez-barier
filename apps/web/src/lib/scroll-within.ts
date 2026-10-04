/**
 * Brings `element` into view by scrolling only its nearest scrolling ancestor. Unlike
 * `scrollIntoView`, the page itself never moves, so a map laid out next to that ancestor stays put.
 * `topInset`: px at the top of the scroller covered by something sticky, which the element must clear.
 */
export function scrollIntoViewWithin(element: HTMLElement, behavior: ScrollBehavior = "smooth", topInset = 0) {
  const scroller = scrollParent(element);
  const view = scroller?.getBoundingClientRect();
  // No scroller, or it lies entirely below the fold (landscape phone): only moving the page can show the element.
  if (!scroller || !view || view.top >= window.innerHeight) {
    element.scrollIntoView({ block: "nearest", behavior });
    return;
  }
  const box = element.getBoundingClientRect();
  // On a short phone the scroller can reach below the fold; only its on-screen part counts as visible.
  const bottom = Math.min(view.bottom, window.innerHeight);
  const top = view.top + topInset;
  const delta = box.top < top ? box.top - top : box.bottom > bottom ? Math.min(box.bottom - bottom, box.top - top) : 0;
  if (delta) scroller.scrollBy({ top: delta, behavior });
}

/** The nearest ancestor of `element` that scrolls vertically, or null when only the page does. */
export function scrollParent(element: HTMLElement): HTMLElement | null {
  let scroller = element.parentElement;
  while (scroller && !/auto|scroll/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
  return scroller;
}
