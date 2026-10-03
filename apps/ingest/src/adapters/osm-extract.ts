import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { CategoryConfig } from "@krakow-bez-barier/contracts";
import { createOSMStream } from "osm-pbf-parser-node";
import type { FetchContext } from "../adapter";
import { SourceHttpError } from "../errors";
import type { OsmElement } from "./osm-map";

type Bbox = FetchContext["city"]["bbox"];
type Box = { south: number; west: number; north: number; east: number };

type PbfHeader = { osmosis_replication_timestamp?: number };
type PbfInfo = { version?: number };
type PbfNode = { type: "node"; id: number; lat: number; lon: number; tags?: Record<string, string>; info?: PbfInfo };
type PbfWay = { type: "way"; id: number; refs: number[]; tags?: Record<string, string>; info?: PbfInfo };
type PbfRelation = {
  type: "relation";
  id: number;
  members: { type: "node" | "way" | "relation"; ref: number }[];
  tags?: Record<string, string>;
  info?: PbfInfo;
};
type PbfItem = PbfHeader | PbfNode | PbfWay | PbfRelation;

export type OsmExtract = {
  elements: OsmElement[];
  /** When the extract's data was current: the replication timestamp in the PBF header, else the download's Last-Modified. */
  extractedAt: Date | null;
};

/**
 * Node coordinates are kept for this much around the city box (degrees, ~2 km), so a way that
 * crosses the box edge still gets a centre from (nearly) all its nodes.
 */
const NODE_MARGIN_DEG = 0.02;
const REVALIDATE_AFTER_MS = 24 * 60 * 60 * 1000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;
/** A cached copy older than this is not used when Geofabrik cannot be reached: it would roll facts back. */
const MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;

const matchesAny = (tags: Record<string, string> | undefined, categories: readonly CategoryConfig[]) =>
  !!tags &&
  categories.some((c) => c.osm.some((rule) => tags[rule.key] !== undefined && rule.values.includes(tags[rule.key])));

const inside = (lat: number, lon: number, b: Box) => lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east;
const intersects = (a: Box, b: Box) => a.south <= b.north && a.north >= b.south && a.west <= b.east && a.east >= b.west;
/** OSM stores coordinates to 7 decimal places; so does the centre. */
const round7 = (n: number) => Math.round(n * 1e7) / 1e7;
const centerOf = (b: Box) => ({ lat: round7((b.south + b.north) / 2), lon: round7((b.west + b.east) / 2) });

function extend(box: Box | null, lat: number, lon: number): Box {
  if (!box) return { south: lat, north: lat, west: lon, east: lon };
  return {
    south: Math.min(box.south, lat),
    north: Math.max(box.north, lat),
    west: Math.min(box.west, lon),
    east: Math.max(box.east, lon),
  };
}

const union = (a: Box | null, b: Box): Box => extend(extend(a, b.south, b.west), b.north, b.east);

const toElement = (item: PbfNode | PbfWay | PbfRelation, center?: { lat: number; lon: number }): OsmElement => ({
  type: item.type,
  id: item.id,
  ...(item.info?.version !== undefined && item.info.version > 0 ? { version: item.info.version } : {}),
  ...(item.type === "node" ? { lat: item.lat, lon: item.lon } : { center }),
  tags: item.tags,
});

/**
 * Reads an OSM PBF extract into Overpass-shaped elements: nodes, ways and relations inside the
 * box with a tag from the categories, ways and relations with the centre of their bounding box
 * (what Overpass `out center` gives). Relies on the standard PBF order (nodes, ways, relations).
 */
export async function readOsmExtract(
  file: string,
  bbox: Bbox,
  categories: readonly CategoryConfig[],
): Promise<{ elements: OsmElement[]; replicatedAt: Date | null }> {
  const around: Box = {
    south: bbox.south - NODE_MARGIN_DEG,
    north: bbox.north + NODE_MARGIN_DEG,
    west: bbox.west - NODE_MARGIN_DEG,
    east: bbox.east + NODE_MARGIN_DEG,
  };
  const nodes = new Map<number, [number, number]>();
  const ways = new Map<number, Box>();
  const elements: OsmElement[] = [];
  let replicatedAt: Date | null = null;

  for await (const item of createOSMStream(file, { withInfo: true }) as AsyncGenerator<PbfItem>) {
    if (!("type" in item)) {
      const seconds = item.osmosis_replication_timestamp;
      if (seconds) replicatedAt = new Date(seconds * 1000);
      continue;
    }
    if (item.type === "node") {
      if (!inside(item.lat, item.lon, around)) continue;
      nodes.set(item.id, [item.lat, item.lon]);
      if (inside(item.lat, item.lon, bbox) && matchesAny(item.tags, categories)) elements.push(toElement(item));
    } else if (item.type === "way") {
      let box: Box | null = null;
      let touchesBbox = false;
      for (const ref of item.refs) {
        const at = nodes.get(ref);
        if (!at) continue;
        box = extend(box, at[0], at[1]);
        touchesBbox ||= inside(at[0], at[1], bbox);
      }
      if (!box) continue;
      ways.set(item.id, box);
      if (touchesBbox && matchesAny(item.tags, categories)) elements.push(toElement(item, centerOf(box)));
    } else {
      if (!matchesAny(item.tags, categories)) continue;
      let box: Box | null = null;
      for (const m of item.members) {
        if (m.type === "way") {
          const wayBox = ways.get(m.ref);
          if (wayBox) box = union(box, wayBox);
        } else if (m.type === "node") {
          const at = nodes.get(m.ref);
          if (at) box = extend(box, at[0], at[1]);
        }
      }
      if (box && intersects(box, bbox)) elements.push(toElement(item, centerOf(box)));
    }
  }
  return { elements, replicatedAt };
}

type DownloadMeta = { url: string; lastModified: string | null; checkedAt: number };

async function readMeta(file: string): Promise<DownloadMeta | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as DownloadMeta;
  } catch {
    return null;
  }
}

const exists = (file: string) =>
  stat(file).then(
    () => true,
    () => false,
  );

/**
 * Downloads the extract to `dir`, reusing a copy checked within a day and revalidating an older
 * one with If-Modified-Since. When the download fails, a copy up to a week old is used as it is.
 */
export async function downloadExtract(
  url: string,
  dir: string,
  userAgent: string,
  log: (message: string) => void = () => {},
): Promise<{ file: string; lastModified: Date | null }> {
  const name = path.basename(new URL(url).pathname);
  const file = path.join(dir, name);
  const metaFile = `${file}.meta.json`;
  const meta = (await readMeta(metaFile)) ?? null;
  const cached = meta?.url === url && (await exists(file)) ? meta : null;
  const result = (m: DownloadMeta) => ({ file, lastModified: m.lastModified ? new Date(m.lastModified) : null });

  if (cached && Date.now() - cached.checkedAt < REVALIDATE_AFTER_MS) return result(cached);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        ...(cached?.lastModified ? { "If-Modified-Since": cached.lastModified } : {}),
      },
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (cached && response.status === 304) {
      const fresh = { ...cached, checkedAt: Date.now() };
      await writeFile(metaFile, JSON.stringify(fresh));
      return result(fresh);
    }
    if (!response.ok || !response.body) {
      throw new SourceHttpError(`Extract download responded ${response.status} ${response.statusText}`, response.status);
    }
    await mkdir(dir, { recursive: true });
    const partial = `${file}.${process.pid}.part`;
    try {
      await pipeline(Readable.fromWeb(response.body as never), createWriteStream(partial));
      await rename(partial, file);
    } catch (e) {
      await rm(partial, { force: true });
      throw e;
    }
    const fresh: DownloadMeta = { url, lastModified: response.headers.get("Last-Modified"), checkedAt: Date.now() };
    await writeFile(metaFile, JSON.stringify(fresh));
    log(`downloaded ${url}`);
    return result(fresh);
  } catch (e) {
    const age = cached ? Date.now() - (cached.lastModified ? Date.parse(cached.lastModified) : cached.checkedAt) : Infinity;
    if (!cached || !(age < MAX_STALE_MS)) throw e;
    log(`extract revalidation failed (${e instanceof Error ? e.message : String(e)}), using the cached copy`);
    return result(cached);
  }
}

/**
 * Downloads (or reuses from `INGEST_CACHE_DIR`) the extract and reads the city's elements from it.
 * Without a cache dir the file goes to a temporary directory that is removed afterwards.
 */
export async function loadOsmExtract(
  url: string,
  ctx: FetchContext,
  categories: readonly CategoryConfig[],
): Promise<OsmExtract> {
  const cacheDir = process.env.INGEST_CACHE_DIR;
  const dir = cacheDir ?? (await mkdtemp(path.join(tmpdir(), "kbb-osm-extract-")));
  try {
    const { file, lastModified } = await downloadExtract(url, dir, ctx.userAgent, ctx.log);
    try {
      const { elements, replicatedAt } = await readOsmExtract(file, ctx.city.bbox, categories);
      return { elements, extractedAt: replicatedAt ?? lastModified };
    } catch (e) {
      // A broken copy would otherwise be revalidated (304) and fail on every run.
      await rm(file, { force: true });
      await rm(`${file}.meta.json`, { force: true });
      throw e;
    }
  } finally {
    if (!cacheDir) await rm(dir, { recursive: true, force: true });
  }
}
