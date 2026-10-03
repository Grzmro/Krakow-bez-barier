// Records Kraków's context figures from GUS Bank Danych Lokalnych into src/domain/gus-bdl-krakow.json. The app only
// reads that file; nothing calls GUS at request time.
//
//   npm run gus:record -w apps/web
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { GUS_BDL_INDICATORS, GUS_BDL_SOURCE, latestBdlValue, type GusSnapshot } from "../src/domain/gus-bdl";

const base = process.env.GUS_BDL_BASE_URL || GUS_BDL_SOURCE.apiUrl;
const snapshot: GusSnapshot = { fetchedAt: new Date().toISOString(), indicators: [] };

for (const indicator of GUS_BDL_INDICATORS) {
  const url = `${base}/data/by-unit/${indicator.unitId}?var-id=${indicator.variableId}&format=json&lang=pl`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`BDL ${response.status} for variable ${indicator.variableId}`);
  snapshot.indicators.push({ ...indicator, ...latestBdlValue(await response.json(), indicator.variableId) });
  // The keyless API allows a few requests per second.
  await new Promise((resolve) => setTimeout(resolve, 1_000));
}

const file = path.join(import.meta.dirname, "../src/domain/gus-bdl-krakow.json");
await writeFile(file, `${JSON.stringify(snapshot, null, 2)}\n`);
for (const i of snapshot.indicators) console.log(`${i.key}: ${i.value} (${i.year}, var ${i.variableId})`);
