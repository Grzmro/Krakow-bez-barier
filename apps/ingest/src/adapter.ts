import type {
  AccessibilityAttribute,
  Category,
  FactValue,
  Reliability,
  SourceKind,
} from "@krakow-bez-barier/contracts";
import type { FactEvidence } from "@krakow-bez-barier/db";
import type { CityConfig } from "./cities/types";

export type SourceMeta = {
  id: string;
  name: string;
  kind: SourceKind;
  url: string;
  license: string;
  /** False until someone has seen the licence at its source; such a source is never ingested. */
  licenseConfirmed: boolean;
  termsUrl?: string;
  attribution: string;
  refreshInterval: string;
  baseReliability: Reliability;
};

export type MappedFact = {
  attribute: AccessibilityAttribute;
  value: FactValue;
  /** `<source>:<kind>/<id>[@version]` — identifies the record the fact came from. */
  recordRef: string;
  observedAt: Date | null;
  evidence: FactEvidence | null;
};

export type MappedPlace = {
  externalRef: string;
  name: string;
  category: Category;
  location: { x: number; y: number };
  street: string | null;
  houseNumber: string | null;
  facts: MappedFact[];
};

export type MapResult = {
  place: MappedPlace | null;
  /** Source values that could not be mapped to the vocabulary, e.g. `kerb=raised`. */
  skipped: string[];
};

export type FetchContext = {
  city: CityConfig;
  userAgent: string;
};

export interface SourceAdapter<Raw = unknown> {
  meta: SourceMeta;
  fetch(ctx: FetchContext): Promise<Raw[]>;
  map(record: Raw): MapResult;
}
