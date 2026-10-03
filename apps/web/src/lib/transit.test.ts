import type { TransitDepartures } from "@krakow-bez-barier/contracts";
import { describe, expect, it } from "vitest";
import { departuresNotice, formatClock, formatDateTime, VEHICLE_STATUS } from "./transit";

type Over = Partial<TransitDepartures> & { refreshStatus?: TransitDepartures["source"]["refreshStatus"]; statusNote?: string };
const answer = ({ refreshStatus, statusNote, ...over }: Over) =>
  ({
    mode: "live",
    fetchedAt: "2026-10-03T18:16:25Z",
    stops: [],
    ...over,
    source: { id: "ztp-gtfs-rt", name: "ZTP", kind: "official_open_data", license: "?", refreshStatus: refreshStatus ?? "ok", lastSuccessAt: null, statusNote },
  }) as TransitDepartures;

describe("transit helpers", () => {
  it("formats times in Kraków time", () => {
    // GIVEN / WHEN / THEN UTC 18:16 is 20:16 in Kraków in October
    expect(formatClock("2026-10-03T18:16:25Z", "pl")).toBe("20:16");
    expect(formatDateTime("2026-10-03T18:16:25Z", "pl")).toBe("3.10.2026, 20:16");
  });

  it("never shows an unverified or missing vehicle flag as met", () => {
    // GIVEN / WHEN / THEN
    expect(VEHICLE_STATUS).toEqual({ accessible: "met", inaccessible: "barrier", unverified: "unknown", no_data: "unknown" });
  });

  it.each([
    [answer({}), null],
    [answer({ mode: "recorded" }), "recorded"],
    [answer({ refreshStatus: "outage" }), "outage"],
    [answer({ refreshStatus: "outage", fetchedAt: null }), "outageNoData"],
    [answer({ refreshStatus: "stale" }), "stale"],
    [answer({ statusNote: "Część danych przewoźnika jest niedostępna (autobusy)." }), "partial"],
    [answer({ mode: "recorded", refreshStatus: "outage" }), "outage"],
    [answer({ mode: "disabled", fetchedAt: null, refreshStatus: "never" }), "disabled"],
  ])("notice for %#", (data, notice) => {
    // GIVEN an answer / WHEN the notice is picked / THEN an outage outranks the recording label
    expect(departuresNotice(data)).toBe(notice);
  });
});
