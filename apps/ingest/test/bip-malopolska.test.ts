import { existsSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { categories } from "@krakow-bez-barier/contracts";
import {
  bipMalopolska,
  licensedPages,
  mapDeclarationPlace,
  unitOf,
  type Declaration,
  type DeclarationRecord,
} from "../src/adapters/bip-malopolska";
import { declarationArchitecture, extractFacts, htmlLines } from "../src/adapters/declaration-extract";
import { krakow } from "../src/cities/krakow";
import type { CityConfig, SourcePage } from "../src/cities/types";
import { adapters } from "../src/registry";

const pages = krakow.sourceConfig["bip-malopolska"]?.pages ?? [];
const fixture = (unit: string) => new URL(`./fixtures/bip-malopolska/${unit}.json`, import.meta.url);
const declaration = (unit: string): Declaration => JSON.parse(readFileSync(fixture(unit), "utf8"));

/** The configured place, with the recorded declaration (the API response, trimmed to the fields we read). */
function record(unit: string, placeId: string): DeclarationRecord {
  const page = pages.find((p) => unitOf(p.url) === unit);
  const place = page?.places.find((p) => p.id === placeId);
  if (!page || !place) throw new Error(`no configured place ${unit}/${placeId}`);
  return { url: page.url, declaration: declaration(unit), place };
}

const factsOf = (r: DeclarationRecord) =>
  Object.fromEntries((mapDeclarationPlace(r).place?.facts ?? []).map((f) => [f.attribute, f.value]));
const quoteOf = (r: DeclarationRecord, attribute: string) =>
  mapDeclarationPlace(r).place?.facts.find((f) => f.attribute === attribute)?.evidence?.comment;
const yes = { kind: "boolean", boolean: true };
const no = { kind: "boolean", boolean: false };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("declarationArchitecture", () => {
  it("reads the architecture part of a template declaration and stops at the next part", () => {
    // GIVEN the recorded MUW declaration
    // WHEN reading its architecture part
    const lines = declarationArchitecture(declaration("muw").content);

    // THEN it starts at its heading, has the buildings and none of the communication part
    expect(lines[0]).toBe("Dostępność architektoniczna");
    expect(lines).toContain("Budynek przy ul. Basztowej 22 w Krakowie");
    expect(lines.some((l) => l.includes("Dostępność komunikacyjno"))).toBe(false);
  });

  it("is empty for a declaration without the part", () => {
    // GIVEN a declaration with only the introduction
    // WHEN reading the architecture part
    // THEN there is nothing to read
    expect(declarationArchitecture('<p id="a11y-wstep">Muzeum zobowiązuje się …</p>')).toEqual([]);
  });

  it("decodes the named entities editors produce", () => {
    // GIVEN HTML with "&oacute;" and "&ndash;"
    // WHEN reading it
    // THEN the text is plain Polish and "&ndash;" does not end a sentence at its semicolon
    expect(htmlLines("<p>Dw&oacute;ch wind &ndash; I piętro</p>")).toEqual(["Dwóch wind – I piętro"]);
  });
});

describe("mapDeclarationPlace", () => {
  it("maps a building with a quote, the declaration link and the declaration's last change", () => {
    // GIVEN the MUW declaration and its Basztowa 22 building
    const r = record("muw", "basztowa-22");

    // WHEN mapping it
    const { place } = mapDeclarationPlace(r);

    // THEN the facts attach to the OSM building and cite the declaration
    expect(place).toMatchObject({
      externalRef: "bip-malopolska:page/muw/basztowa-22",
      sameAs: "osm:way/167351784",
      category: "other",
    });
    expect(factsOf(r)).toMatchObject({ lift: yes, ramp: yes, toilet_accessible: yes });
    expect(place?.facts.find((f) => f.attribute === "toilet_accessible")).toMatchObject({
      recordRef: "bip-malopolska:page/muw/basztowa-22@2026-09-09",
      observedAt: new Date("2026-09-09T00:00:00Z"),
      evidence: {
        comment: "„Toalety dla osób z niepełnosprawnością znajdują się na każdym piętrze.”",
        url: "https://bip.malopolska.pl/muw,e,deklaracja.html",
      },
    });
  });

  it("reads a list of missing things as barriers", () => {
    // GIVEN Sebastiana 9: "brak windy oraz platformy …, a także podjazdu przed budynkiem"
    const r = record("muw", "sebastiana-9");

    // WHEN mapping it
    const facts = factsOf(r);

    // THEN the lift, the ramp and the toilet are known to be missing and the steps make the entrance not level
    expect(facts).toMatchObject({ lift: no, ramp: no, toilet_accessible: no, entrance_level: no });
    expect(quoteOf(r, "ramp")).toBe(
      "„W budynku brak windy oraz platformy dla osób z niepełnosprawnościami, a także podjazdu przed budynkiem.”",
    );
  });

  it("does not carry a negation over a comma into a new clause", () => {
    // GIVEN Przy Rondzie 6: "Brak znaczników … przy wejściach do toalet, windy posiadają oznakowania"
    // WHEN mapping it
    const facts = factsOf(record("muw", "przy-rondzie-6"));

    // THEN the lifts stated elsewhere are not contradicted
    expect(facts.lift).toEqual(yes);
  });

  it("splits two buildings described in one paragraph by sentence", () => {
    // GIVEN the Ethnographic Museum declaration, whose Ratusz and Dom Esterki share a paragraph
    // WHEN mapping each building
    const ratusz = factsOf(record("meisuwkrakowie", "ratusz"));
    const esterka = factsOf(record("meisuwkrakowie", "dom-esterki"));

    // THEN Dom Esterki's adapted toilet does not leak into the Ratusz, whose toilet text is unclear
    expect(esterka.toilet_accessible).toEqual(yes);
    expect(ratusz.toilet_accessible).toBeUndefined();
    expect(mapDeclarationPlace(record("meisuwkrakowie", "ratusz")).skipped).toContain(
      "bip-malopolska:page/meisuwkrakowie/ratusz toilet_accessible: ambiguous",
    );
    expect(ratusz.lift).toEqual(yes);
  });

  it("gives no place for a declaration without an architecture part", () => {
    // GIVEN a configured place whose declaration lost the part
    const r = record("ankrakow", "rakowicka-22e");

    // WHEN mapping it
    const result = mapDeclarationPlace({ ...r, declaration: { ...r.declaration, content: "<p>Deklaracja</p>" } });

    // THEN nothing is written and the reason is logged
    expect(result).toEqual({ place: null, skipped: ["bip-malopolska:page/ankrakow/rakowicka-22e: no architecture part"] });
  });
});

describe("extractFacts on declaration wording", () => {
  it("does not read a denied obstacle as a missing toilet", () => {
    // GIVEN "Nie ma przeszkód, by wjechać na wózku do łazienki"
    const lines = ["W budynku są cztery toalety dostępne dla osób z niepełnosprawnościami", "Nie ma przeszkód, by wjechać na wózku do łazienki"];

    // WHEN extracting
    const { facts, skipped } = extractFacts(lines);

    // THEN the toilet is accessible, not ambiguous
    expect(facts).toContainEqual(expect.objectContaining({ attribute: "toilet_accessible", value: yes }));
    expect(skipped).toEqual([]);
  });

  it("reads the statement after a lead-in ending with a colon", () => {
    // GIVEN a template lead-in, which alone is ignored as a heading
    const lines = ["Informacje o dostępności toalet dla osób niepełnosprawnych: W budynku jest toaleta dostosowana do potrzeb osób niepełnosprawnych."];

    // WHEN extracting
    // THEN the statement after the colon is a fact quoting only itself
    expect(extractFacts(lines).facts).toEqual([
      { attribute: "toilet_accessible", value: yes, quote: "W budynku jest toaleta dostosowana do potrzeb osób niepełnosprawnych." },
    ]);
  });
});

describe("bip-malopolska licence gate", () => {
  it("fetches only declarations whose publisher's reuse terms are confirmed", () => {
    // GIVEN one confirmed and one unconfirmed page
    const confirmed: SourcePage = { url: "https://bip.malopolska.pl/muw,e,deklaracja.html", places: [], license: { confirmed: true, terms: "BIP" } };
    const pending: SourcePage = { url: "https://bip.malopolska.pl/okrakowska,e,deklaracja.html", places: [], license: { confirmed: false, terms: "do potwierdzenia" } };
    const log = vi.fn();

    // WHEN filtering
    const kept = licensedPages([confirmed, pending, { url: pending.url, places: [] }], log);

    // THEN only the confirmed one is kept and the others are logged with their terms
    expect(kept).toEqual([confirmed]);
    expect(log).toHaveBeenCalledWith(
      "https://bip.malopolska.pl/okrakowska,e,deklaracja.html: reuse terms not confirmed (do potwierdzenia), not fetched",
    );
    expect(log).toHaveBeenCalledWith(
      "https://bip.malopolska.pl/okrakowska,e,deklaracja.html: reuse terms not confirmed (none recorded), not fetched",
    );
  });

  it("keeps theatres and the opera behind the gate", () => {
    // GIVEN the Kraków config
    // WHEN looking at cultural institutions other than museums and libraries
    const theatres = pages.filter((p) => p.places.some((place) => place.category === "theatre"));

    // THEN none of them is fetched until its terms are confirmed
    expect(theatres.length).toBeGreaterThan(0);
    for (const page of theatres) expect(page.license?.confirmed, page.url).toBe(false);
  });

  it("reads the declaration from the configured API with the ingest User-Agent", async () => {
    // GIVEN a city with one licensed and one unlicensed declaration, and the API answering with the recorded MUW one
    const muw = pages.find((p) => unitOf(p.url) === "muw")!;
    const opera = pages.find((p) => unitOf(p.url) === "okrakowska")!;
    const city: CityConfig = {
      ...krakow,
      sourceConfig: { "bip-malopolska": { endpoint: "https://bip.example/api/", pages: [muw, opera] } },
    };
    const fetchMock = vi.fn(async () => new Response(readFileSync(fixture("muw"), "utf8"), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    // WHEN fetching
    const records = (await bipMalopolska.fetch({ city, userAgent: "test-agent" })) as DeclarationRecord[];

    // THEN only MUW is requested, once, and each of its places gets the declaration
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("https://bip.example/api/contexts/muw/accessibility-declaration");
    expect(init.headers).toMatchObject({ "User-Agent": "test-agent" });
    expect(records.map((r) => r.place.id)).toEqual(muw.places.map((p) => p.id));
    expect(records[0].declaration.modifyDate).toBe("2026-09-09 13:22:50");
  });

  it("fails the run when the API refuses every declaration", async () => {
    // GIVEN an API answering 503
    const muw = pages.find((p) => unitOf(p.url) === "muw")!;
    const city: CityConfig = { ...krakow, sourceConfig: { "bip-malopolska": { endpoint: "https://bip.example/api/", pages: [muw] } } };
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503, statusText: "Service Unavailable" })));

    // WHEN fetching
    // THEN the error reaches the runner, which keeps the previous facts
    await expect(bipMalopolska.fetch({ city, userAgent: "test-agent" })).rejects.toThrow("BIP Małopolska responded 503");
  });
});

describe("bip-malopolska source config", () => {
  it("is registered as the venue's own declaration, extracted, with a processed-information note", () => {
    // GIVEN the registry
    // WHEN reading the source
    const meta = adapters["bip-malopolska"].meta;

    // THEN it can be ingested and says how the facts were obtained
    expect(meta).toMatchObject({ kind: "venue_owner", licenseConfirmed: true, baseReliability: "extracted" });
    expect(meta.license).not.toMatch(/^to be confirmed/i);
    expect(meta.attribution).toContain("Informacja przetworzona");
    expect(krakow.sources).toContain("bip-malopolska");
  });

  it("gives every licensed place facts from its recorded declaration", () => {
    // GIVEN every place of a page whose terms are confirmed
    const licensed = pages.filter((p) => p.license?.confirmed);
    const known = new Set(categories.map((c) => c.id));

    // WHEN mapping each with its recorded declaration
    // THEN each is well-formed and yields facts, and at least five institutions do
    expect(licensed.length).toBeGreaterThanOrEqual(5);
    for (const page of licensed) {
      const unit = unitOf(page.url);
      expect(existsSync(fixture(unit)), unit).toBe(true);
      for (const place of page.places) {
        expect(known.has(place.category), place.id).toBe(true);
        expect(place.osmRef, place.id).toMatch(/^osm:(node|way|relation)\/\d+$/);
        const { place: mapped } = mapDeclarationPlace({ url: page.url, declaration: declaration(unit), place });
        expect(mapped?.facts.length, `${unit}/${place.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("rejects a page that is not a declaration of the regional BIP", () => {
    // GIVEN a page of another site
    // WHEN reading its unit
    // THEN the config error is explicit
    expect(() => unitOf("https://mnk.pl/deklaracja-dostepnosci")).toThrow("Not a bip.malopolska.pl declaration page");
  });
});
