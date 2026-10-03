import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CACHE_TTL_MS = 60 * 60 * 1000;

async function readCache<T>(file: string): Promise<T[] | null> {
  try {
    const { fetchedAt, records } = JSON.parse(await readFile(file, "utf8"));
    return Date.now() - fetchedAt < CACHE_TTL_MS && Array.isArray(records) ? records : null;
  } catch {
    return null;
  }
}

/**
 * Development download cache: with `INGEST_CACHE_DIR` set, a download younger than an hour is
 * reused instead of hitting the provider again. Without it, always loads.
 */
export async function withDownloadCache<T>(name: string, load: () => Promise<T[]>): Promise<T[]> {
  const cacheDir = process.env.INGEST_CACHE_DIR;
  if (!cacheDir) return load();

  const file = path.join(cacheDir, `${name}.json`);
  const cached = await readCache<T>(file);
  if (cached) return cached;

  const records = await load();
  await mkdir(cacheDir, { recursive: true });
  await writeFile(file, JSON.stringify({ fetchedAt: Date.now(), records }));
  return records;
}
