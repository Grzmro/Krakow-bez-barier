export type CityConfig = {
  id: string;
  name: string;
  bbox: { south: number; west: number; north: number; east: number };
  /** Source ids enabled for this city. */
  sources: string[];
  /** Endpoints and other per-source settings; the key is the source id. */
  sourceConfig: Record<string, { endpoint?: string }>;
};
