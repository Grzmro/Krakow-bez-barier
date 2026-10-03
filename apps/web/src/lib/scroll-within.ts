/**
 * Brings `element` into view by scrolling only its nearest scrolling ancestor. Unlike
 * `scrollIntoView`, the page itself never moves, so a map laid out next to that ancestor stays put.
 */
export function scrollIntoViewWithin(element: HTMLElement, behavior: ScrollBehavior = "smooth") {
  let scroller = element.parentElement;
  while (scroller && !/auto|scroll/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
  if (!scroller) return;
  const box = element.getBoundingClientRect();
  const view = scroller.getBoundingClientRect();
  // On a short phone the scroller can reach below the fold; only its on-screen part counts as visible.
  const bottom = Math.min(view.bottom, window.innerHeight);
  const delta = box.top < view.top ? box.top - view.top : box.bottom > bottom ? Math.min(box.bottom - bottom, box.top - view.top) : 0;
  if (delta) scroller.scrollBy({ top: delta, behavior });
}
