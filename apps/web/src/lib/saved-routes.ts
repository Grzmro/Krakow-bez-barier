import type { Place, Route } from "@krakow-bez-barier/contracts";

/**
 * A route kept on this device for the way (no server, R7): the route with its step facts and sources, the start and
 * destination cards, and when it was planned. Positions are `[lon, lat]`.
 */
export type SavedRoute = {
  id: string;
  savedAt: string;
  /** When the route was computed (it may have been on screen a while before it was saved). */
  plannedAt: string;
  from: [number, number];
  to: [number, number];
  startName: string;
  endName: string;
  route: Route;
  start: Place | null;
  destination: Place | null;
};

export type SavedRouteInput = Omit<SavedRoute, "id" | "savedAt">;

const DB_NAME = "kbb-saved-routes";
const STORE = "routes";

const coordinate = ([lon, lat]: [number, number]) => `${lat.toFixed(5)},${lon.toFixed(5)}`;

/** Saving the same ends and kind again replaces the older copy instead of piling up duplicates. */
export function savedRouteRecord(input: SavedRouteInput, now: Date): SavedRoute {
  return {
    ...input,
    id: `${input.route.kind}:${coordinate(input.from)}:${coordinate(input.to)}`,
    savedAt: now.toISOString(),
  };
}

/** Newest first. */
export const sortSaved = (list: SavedRoute[]) => [...list].sort((a, b) => b.savedAt.localeCompare(a.savedAt));

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("blocked"));
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

/** All saved routes, newest first; `null` when this browser can't store them (private mode, storage blocked). */
export async function listSavedRoutes(): Promise<SavedRoute[] | null> {
  try {
    return sortSaved(await run("readonly", (store) => store.getAll() as IDBRequest<SavedRoute[]>));
  } catch {
    return null;
  }
}

/** Stores the route; `null` when the browser refused. */
export async function saveRoute(input: SavedRouteInput): Promise<SavedRoute | null> {
  const record = savedRouteRecord(input, new Date());
  try {
    await run("readwrite", (store) => store.put(record));
    return record;
  } catch {
    return null;
  }
}

export async function deleteSavedRoute(id: string): Promise<boolean> {
  try {
    await run("readwrite", (store) => store.delete(id));
    return true;
  } catch {
    return false;
  }
}
