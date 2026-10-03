/**
 * The count the list heading and the screen-reader announcement state. It is what the list and map show
 * (the fetched page, minus what the verdict filter hides), never the server's `total` for the whole area:
 * that one only appears in the "shown N of M" note.
 */
export function listedCount(page: { items: unknown[] }, shown: number): number {
  return Math.min(shown, page.items.length);
}
