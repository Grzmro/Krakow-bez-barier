import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { categories } from "@krakow-bez-barier/contracts";
import { bipMk, mapBipPlace, type BipRecord } from "../src/adapters/bip-mk";
import { extractFacts, parseBipPage, sentences, sliceSections } from "../src/adapters/bip-mk-extract";
import { krakow } from "../src/cities/krakow";
import type { PagePlace } from "../src/cities/types";
import { adapters } from "../src/registry";

const pages = krakow.sourceConfig["bip-mk"]?.pages ?? [];
const html = (mmi: number) => readFileSync(new URL(`./fixtures/bip-mk/mmi-${mmi}.html`, import.meta.url), "utf8");

/** The configured place, with the recorded page as its HTML. */
function record(mmi: number, placeId: string): BipRecord {
  const page = pages.find((p) => p.url.endsWith(`mmi=${mmi}`));
  const place = page?.places.find((p) => p.id === placeId);
  if (!page || !place) throw new Error(`no configured place ${mmi}/${placeId}`);
  return { url: page.url, html: html(mmi), place };
}

const factsOf = (r: BipRecord) =>
  Object.fromEntries((mapBipPlace(r).place?.facts ?? []).map((f) => [f.attribute, f.value]));
const quoteOf = (r: BipRecord, attribute: string) =>
  mapBipPlace(r).place?.facts.find((f) => f.attribute === attribute)?.evidence?.comment;
const yes = { kind: "boolean", boolean: true };
const no = { kind: "boolean", boolean: false };

describe("parseBipPage", () => {
  it("reads the page body and the dates of its metka", () => {
    // GIVEN the recorded MIT page fetched with metka=1
    // WHEN parsing it
    const page = parseBipPage(html(19180));

    // THEN the dates come from the metka and the text starts below the page heading
    expect(page.publishedAt?.toISOString()).toBe("2020-06-12T00:00:00.000Z");
    expect(page.updatedAt?.toISOString()).toBe("2026-03-19T00:00:00.000Z");
    expect(page.lines[0]).toBe("Muzeum Inżynierii i Techniki w Krakowie");
    expect(page.lines).toContain("1. Siedziba Muzeum – Zajezdnia");
    expect(page.lines.some((l) => l.includes("Metka"))).toBe(false);
  });
});

describe("mapBipPlace", () => {
  it("maps the MIT main site with a quote, the page link and the page's update date", () => {
    // GIVEN the MIT page and its "Zajezdnia" place
    const r = record(19180, "zajezdnia");

    // WHEN mapping it
    const { place } = mapBipPlace(r);

    // THEN it carries the facts of building D, attached to the OSM museum, each citing the page
    expect(place).toMatchObject({
      externalRef: "bip-mk:page/19180/zajezdnia",
      sameAs: "osm:way/638349014",
      category: "museum",
    });
    expect(factsOf(r)).toMatchObject({ lift: yes, toilet_accessible: yes, changing_table: yes, disabled_parking: yes });
    const lift = place?.facts.find((f) => f.attribute === "lift");
    expect(lift).toMatchObject({
      recordRef: "bip-mk:page/19180/zajezdnia@2026-03-19",
      observedAt: new Date("2026-03-19T00:00:00Z"),
      evidence: { comment: "„Komunikację pomiędzy piętrami zapewnia winda.”", url: "https://www.bip.krakow.pl/?mmi=19180" },
    });
  });

  it("reads only its own section on a page about several buildings", () => {
    // GIVEN the Łaźnia Nowa page describing the theatre and Dom Utopii
    // WHEN mapping each place
    const theatre = factsOf(record(20444, "laznia-nowa"));
    const domUtopii = factsOf(record(20444, "dom-utopii"));

    // THEN the theatre has no lift and Dom Utopii has one: the sentences don't leak between them
    expect(theatre.lift).toEqual(no);
    expect(domUtopii.lift).toEqual(yes);
    expect(quoteOf(record(20444, "laznia-nowa"), "lift")).toBe("„W budynku Teatru nie ma windy.”");
  });

  it("joins the sections of a page that goes topic by topic", () => {
    // GIVEN the Dworek Białoprądnicki page, which lists nine locations under every topic
    const r = record(20437, "dworek-bialopradnicki");

    // WHEN mapping the Dworek
    const facts = factsOf(r);

    // THEN it gets its parking from the fourth topic and not the steps of Klub "Wola" from the first
    expect(facts.disabled_parking).toEqual(yes);
    expect(quoteOf(r, "disabled_parking")).toBe("„Parking na terenie z 1 miejscem dla osób z niepełnosprawnością.”");
    expect(facts.entrance_level).toBeUndefined();
  });

  it("states what is missing as false and ignores what the building does not allow", () => {
    // GIVEN the Groteska page: toilets "nie są dostosowane", a lift the listed building "nie pozwala" to build
    const r = record(20442, "groteska");

    // WHEN mapping it
    const facts = factsOf(r);

    // THEN the toilet is a known barrier and the lift stays unknown
    expect(facts.toilet_accessible).toEqual(no);
    expect(facts.lift).toBeUndefined();
  });

  it("gives no place when the configured section is no longer on the page", () => {
    // GIVEN a place whose section heading the page doesn't have
    const r = record(19181, "rakowicka");
    const moved: PagePlace = { ...r.place, sections: [{ from: "Nagłówek, którego nie ma" }] };

    // WHEN mapping it
    const result = mapBipPlace({ ...r, place: moved });

    // THEN nothing is written and the reason is logged
    expect(result.place).toBeNull();
    expect(result.skipped).toEqual(["bip-mk:page/19181/rakowicka: section not found on the page"]);
  });
});

describe("extractFacts", () => {
  it("skips an attribute the text states both ways", () => {
    // GIVEN a section where one building has a lift and another doesn't
    // WHEN extracting
    const { facts, skipped } = extractFacts(["W budynku A jest winda.", "W budynku B nie ma windy."]);

    // THEN there is no lift fact, only a note
    expect(facts.find((f) => f.attribute === "lift")).toBeUndefined();
    expect(skipped).toEqual(["lift: ambiguous"]);
  });

  it("ignores plans, contact lines and headings", () => {
    // GIVEN sentences that mention a lift, a toilet and parking without stating them
    const lines = [
      "Planujemy budowę windy w 2027 roku.",
      "W sprawie toalety dla osób z niepełnosprawnościami prosimy o kontakt: tel. 12 000 00 00.",
      "Informacje o miejscu i sposobie korzystania z miejsc parkingowych wyznaczonych dla osób z niepełnosprawnościami.",
    ];

    // WHEN extracting
    // THEN no fact comes out
    expect(extractFacts(lines).facts).toEqual([]);
  });

  it("reads a single door width in centimetres and a step-free entrance", () => {
    // GIVEN plain statements about the entrance
    const lines = ["Drzwi wejściowe mają szerokość 90 cm.", "Wejście do budynku jest z poziomu chodnika."];

    // WHEN extracting
    const { facts } = extractFacts(lines);

    // THEN both are facts with the sentence as the quote
    expect(facts).toEqual([
      { attribute: "entrance_level", value: yes, quote: "Wejście do budynku jest z poziomu chodnika." },
      { attribute: "door_width_cm", value: { kind: "number", number: 90, unit: "cm" }, quote: "Drzwi wejściowe mają szerokość 90 cm." },
    ]);
  });

  it("does not end a sentence after an abbreviation", () => {
    // GIVEN a sentence with "ul." and "tzw."
    // WHEN splitting
    // THEN it stays whole
    expect(sentences(["Miejsce tzw. koperta jest na ul. Szczepańskiej. Toaleta jest obok."])).toEqual([
      "Miejsce tzw. koperta jest na ul. Szczepańskiej.",
      "Toaleta jest obok.",
    ]);
  });

  it("slices repeated sections in page order", () => {
    // GIVEN lines with the same heading under two topics
    const lines = ["1. Wejście", "A:", "a1", "B:", "b1", "2. Toaleta", "A:", "a2", "B:", "b2"];

    // WHEN slicing A's two sections
    // THEN each starts after the previous one
    expect(sliceSections(lines, [{ from: "A:", to: "B:" }, { from: "A:", to: "B:" }])).toEqual(["A:", "a1", "A:", "a2"]);
  });
});

describe("bip-mk source config", () => {
  it("is registered with a confirmed licence and the GMK disclaimer in its attribution", () => {
    // GIVEN the registry
    // WHEN reading the source
    const meta = adapters["bip-mk"].meta;

    // THEN it can be ingested and credits the city as its terms require
    expect(meta).toMatchObject({ licenseConfirmed: true, baseReliability: "extracted", termsUrl: "https://www.bip.krakow.pl/?dok_id=48482" });
    expect(meta.attribution).toContain("Gmina Miejska Kraków nie ponosi odpowiedzialności");
    expect(meta.attribution).toContain("Informacja przetworzona");
    expect(bipMk.meta).toBe(meta);
    expect(krakow.sources).toContain("bip-mk");
  });

  it("configures at least 15 institutions with unique ids, known categories and an OSM location", () => {
    // GIVEN the configured pages
    const places = pages.flatMap((p) => p.places.map((place) => ({ page: p.url, place })));
    const known = new Set(categories.map((c) => c.id));

    // WHEN checking every place
    // THEN each is well-formed
    expect(places.length).toBeGreaterThanOrEqual(15);
    expect(new Set(places.map(({ page, place }) => `${page}#${place.id}`)).size).toBe(places.length);
    for (const { place } of places) {
      expect(known.has(place.category), place.id).toBe(true);
      expect(place.osmRef, place.id).toMatch(/^osm:(node|way|relation)\/\d+$/);
      expect(place.location.y, place.id).toBeGreaterThan(49.9);
      expect(place.location.x, place.id).toBeGreaterThan(19.7);
    }
  });
});
