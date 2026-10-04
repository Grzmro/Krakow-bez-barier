import type {
  AccessibilityAttribute,
  Category,
  FactEntrance,
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
  /** Set when the fact describes one entrance of the place (`recordRef` is then the entrance's record). */
  entrance?: FactEntrance;
};

export type MappedPlace = {
  externalRef: string;
  name: string;
  category: Category;
  location: { x: number; y: number };
  street: string | null;
  houseNumber: string | null;
  /** External ref of a place from another source that this record describes (e.g. `osm:way/1`); its facts attach there when it exists. */
  sameAs?: string;
  facts: MappedFact[];
  /**
   * The source's entrances were read for this place: an entrance fact it no longer carries is superseded. False or
   * absent when they could not be read, so a failed entrance fetch keeps the last entrance facts.
   */
  entrancesChecked?: boolean;
};

export type MapResult = {
  place: MappedPlace | null;
  /** Source values that could not be mapped to the vocabulary, e.g. `kerb=raised`. */
  skipped: string[];
};

export type FetchContext = {
  city: CityConfig;
  userAgent: string;
  log?: (message: string) => void;
};

/** Records with a note on where they came from, when that is not the source's usual endpoint. */
export type FetchedRecords<Raw> = { records: Raw[]; note: string };

export interface SourceAdapter<Raw = unknown> {
  meta: SourceMeta;
  fetch(ctx: FetchContext): Promise<Raw[] | FetchedRecords<Raw>>;
  map(record: Raw): MapResult;
}
