import { krakow } from "./krakow";
import type { CityConfig } from "./types";

export const cities: Record<string, CityConfig> = { [krakow.id]: krakow };
