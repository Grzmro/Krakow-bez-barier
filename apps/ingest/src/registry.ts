import type { SourceAdapter } from "./adapter";
import { osm } from "./adapters/osm";

export const adapters: Record<string, SourceAdapter<never>> = {
  [osm.meta.id]: osm as SourceAdapter<never>,
};
