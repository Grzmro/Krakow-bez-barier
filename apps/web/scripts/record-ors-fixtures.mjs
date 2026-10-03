// Re-records openrouteservice responses for the routing tests (no test ever calls ORS).
// Each fixture in src/server/routing/fixtures/ holds the key-free request (`request.profile`, `request.body`);
// this script sends it with ORS_API_KEY and stores the answer next to it. The key is never written.
//
//   node --env-file=../../.env scripts/record-ors-fixtures.mjs [fixture-name ...]
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dir = path.join(import.meta.dirname, "..", "src", "server", "routing", "fixtures");
const baseUrl = (process.env.ORS_BASE_URL || "https://api.openrouteservice.org").replace(/\/$/, "");
const apiKey = process.env.ORS_API_KEY;
if (!apiKey) {
  console.error("ORS_API_KEY is not set.");
  process.exit(1);
}

const only = new Set(process.argv.slice(2));
const files = (await readdir(dir)).filter((f) => f.endsWith(".json") && (!only.size || only.has(f.replace(/\.json$/, ""))));

for (const file of files) {
  const fixture = JSON.parse(await readFile(path.join(dir, file), "utf8"));
  const { profile, body } = fixture.request;
  const response = await fetch(`${baseUrl}/v2/directions/${profile}/geojson`, {
    method: "POST",
    headers: { authorization: apiKey, "content-type": "application/json", accept: "application/geo+json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  const recorded = { request: fixture.request, recordedAt: new Date().toISOString(), status: response.status, response: json };
  await writeFile(path.join(dir, file), `${JSON.stringify(recorded, null, 2)}\n`);
  console.log(`${file}: ${response.status}`);
}
