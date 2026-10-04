import { describe, expect, it } from "vitest";
import { createApiClient, createMockFetch, type Outage, type Place } from "@krakow-bez-barier/contracts";
import {
  buildCityReport,
  cityReportMailto,
  cityReportText,
  hasReportableBarrier,
  isReportAddress,
  MAILTO_MAX_LENGTH,
} from "./city-report";

const api = createApiClient({ baseUrl: "http://localhost/api/v1", fetch: createMockFetch() });
const URL_OF_PLACE = "https://example.test/miejsca/palac-krzysztofory";
const NOW = new Date("2026-10-04T10:00:00Z");

async function demoPlace(id: string): Promise<Place> {
  const { data } = await api.GET("/places/{id}", { params: { path: { id } } });
  if (!data) throw new Error(`no example for ${id}`);
  return data;
}

const outage: Outage = {
  id: "o1",
  equipment: "lift",
  reliability: "user_report",
  state: "confirmed",
  confirmations: 2,
  workingVotes: 0,
  reportedAt: "2026-10-03T08:00:00Z",
  lastConfirmedAt: "2026-10-03T09:00:00Z",
  expiresAt: "2026-10-05T08:00:00Z",
};

describe("buildCityReport", () => {
  it("names the place, address, coordinates and link, and each barrier with its source and date", async () => {
    // GIVEN a place whose toilet sources conflict
    const place = await demoPlace("palac-krzysztofory");

    // WHEN the report is built
    const report = buildCityReport({ place, url: URL_OF_PLACE, locale: "pl", now: NOW });

    // THEN the place, coordinates and the card link are in the body
    const [lon, lat] = place.location.coordinates;
    expect(report.body).toContain(`Miejsce: ${place.name}`);
    expect(report.body).toContain(`${lat.toFixed(6)}, ${lon.toFixed(6)}`);
    expect(report.body).toContain(URL_OF_PLACE);
    // AND both conflicting sources are named with their value and fetch date
    expect(report.body).toContain("źródła się różnią (Jest / Nie ma)");
    expect(report.body).toMatch(/źródło: MSIP: Toalety publiczne, podaje: Jest, pobrano \d+\.\d+\.\d{4}/);
    expect(report.body).toMatch(/źródło: OpenStreetMap, podaje: Nie ma, pobrano \d+\.\d+\.\d{4}/);
    // AND the subject carries the place
    expect(report.subject).toContain(place.name);
  });

  it("lists an active outage as an unverified visitor report", async () => {
    // GIVEN a place with a confirmed lift outage
    const place = { ...(await demoPlace("kawiarnia-przyklad")), outages: [outage] };

    // WHEN the report is built
    const body = buildCityReport({ place, url: URL_OF_PLACE, locale: "pl", now: NOW }).body;

    // THEN the outage is there with its date, confirmations and its unverified status
    expect(body).toContain("Awaria windy: zgłoszenie odwiedzających z 3.10.2026, niezweryfikowane, potwierdzeń: 2");
  });

  it("holds no personal data and marks sample sources", async () => {
    // GIVEN a place with a sample source
    const base = await demoPlace("palac-krzysztofory");
    const place: Place = { ...base, sources: base.sources.map((s) => ({ ...s, isSample: true })) };

    // WHEN the report is built
    const text = cityReportText(buildCityReport({ place, url: URL_OF_PLACE, locale: "pl", now: NOW }));

    // THEN sample data is labelled and nothing identifies the sender
    expect(text).toContain("[PRZYKŁAD]");
    expect(text).not.toMatch(/@/);
    expect(text).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
  });

  it("is written in the requested language", async () => {
    // GIVEN a place and the English catalog
    const place = await demoPlace("palac-krzysztofory");

    // WHEN the report is built in English
    const report = buildCityReport({ place, url: URL_OF_PLACE, locale: "en", now: NOW });

    // THEN the English twin is used
    expect(report.subject).toMatch(/^Accessibility barrier: /);
    expect(report.body).toContain("Reported barriers:");
  });
});

describe("hasReportableBarrier", () => {
  it("is true for conflicts and outages, false for a place with nothing known", async () => {
    // GIVEN a conflicting place and an empty one
    const conflicting = await demoPlace("palac-krzysztofory");
    const empty = await demoPlace("kawiarnia-przyklad");

    // THEN unknown data alone is not a barrier, conflicts and outages are
    expect(hasReportableBarrier(conflicting)).toBe(true);
    expect(hasReportableBarrier(empty)).toBe(false);
    expect(hasReportableBarrier({ ...empty, outages: [outage] })).toBe(true);
    expect(hasReportableBarrier({ ...empty, outages: [{ ...outage, state: "resolved" }] })).toBe(false);
  });
});

describe("cityReportMailto", () => {
  const report = { subject: "Bariera: Pałac Krzysztofory, Szczepańska 1", body: "Dzień dobry,\nŁódź & „Kraków”: 50% #1\nKoniec" };

  it("encodes Polish letters, reserved characters and CRLF newlines", () => {
    // WHEN building the link for a valid address
    const url = cityReportMailto("zgloszenia@example.pl", report);

    // THEN it is a mailto with percent-encoded subject and body
    expect(url).toMatch(/^mailto:zgloszenia@example\.pl\?subject=/);
    const params = new URLSearchParams(url!.split("?")[1]);
    expect(params.get("subject")).toBe(report.subject);
    expect(params.get("body")).toBe(report.body.replaceAll("\n", "\r\n"));
    expect(url).not.toMatch(/[\s#"<>]/);
    expect(url).toContain("%0D%0A");
  });

  it("returns null without a usable address", () => {
    // THEN empty, URL, several addresses and header-injection attempts are all rejected
    for (const bad of [undefined, "", "https://form.krakow.pl", "a@b.pl,c@d.pl", "a@b.pl?cc=x@y.pl", "bez-malpy"]) {
      expect(cityReportMailto(bad, report)).toBeNull();
      expect(isReportAddress(bad)).toBe(false);
    }
  });

  it("drops trailing lines until the link fits, keeping the head of the message", () => {
    // GIVEN a body far over the limit, with the place link on line 2
    const long = { subject: "Temat", body: ["Dzień dobry,", "https://example.test/miejsca/x", ...Array(400).fill("źródło: Łąka")].join("\n") };

    // WHEN building the link
    const url = cityReportMailto("a@b.pl", long)!;

    // THEN it fits the limit and still carries the greeting and the link
    expect(url.length).toBeLessThanOrEqual(MAILTO_MAX_LENGTH);
    const body = new URLSearchParams(url.split("?")[1]).get("body")!;
    expect(body).toContain("Dzień dobry,");
    expect(body).toContain("https://example.test/miejsca/x");
  });
});
