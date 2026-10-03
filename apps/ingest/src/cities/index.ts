import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { CityConfig } from "./types";

const here = path.dirname(fileURLToPath(import.meta.url));
const isCityFile = (file: string) => file.endsWith(".ts") && !/^(index|types)\.ts$|\.test\.ts$/.test(file);

/** Every `<city>.ts` in the directory exporting a `CityConfig`: a new file is a new city, no registration. */
export async function loadCities(dir: string = here): Promise<Record<string, CityConfig>> {
  const cities: Record<string, CityConfig> = {};
  for (const file of readdirSync(dir).filter(isCityFile).sort()) {
    const mod = (await import(pathToFileURL(path.join(dir, file)).href)) as Record<string, unknown>;
    for (const value of Object.values(mod)) {
      const city = value as Partial<CityConfig> | null;
      if (city && typeof city === "object" && typeof city.id === "string" && city.bbox) cities[city.id] = city as CityConfig;
    }
  }
  return cities;
}

export const cities = await loadCities();
