// MapLibre's ESM build loads its worker (and the chunk it shares with the main bundle) relative to
// its own URL, which bundlers rewrite. Copy them to public/ so `setWorkerUrl` has a stable path.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/package.json"));
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "vendor", "maplibre");

mkdirSync(target, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(dist, "dist", file), join(target, file));
}
