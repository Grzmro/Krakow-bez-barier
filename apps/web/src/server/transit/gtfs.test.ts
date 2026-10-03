import { strToU8, zipSync } from "fflate";
import { PbfWriter } from "pbf";
import { describe, expect, it } from "vitest";
import { decodeFeed } from "./gtfs-rt";
import { buildStatic, parseCsv, readGtfsZip } from "./gtfs-static";

// Encodes a FeedMessage by gtfs-realtime.proto field numbers, the same way ZTP's feed does.
function encodeFeed(): Uint8Array {
  const pbf = new PbfWriter();
  pbf.writeMessage(1, (_: unknown, p: PbfWriter) => {
    p.writeStringField(1, "2.0");
    p.writeVarintField(3, 1791050783);
  }, null);
  pbf.writeMessage(2, (_: unknown, p: PbfWriter) => {
    p.writeStringField(1, "trip-entity");
    p.writeMessage(3, (__: unknown, tu: PbfWriter) => {
      tu.writeMessage(1, (___: unknown, trip: PbfWriter) => {
        trip.writeStringField(1, "block_109_trip_19_service_2");
        trip.writeStringField(5, "route_8");
      }, null);
      tu.writeMessage(2, (___: unknown, st: PbfWriter) => {
        st.writeVarintField(1, 18);
        st.writeMessage(3, (____: unknown, ev: PbfWriter) => {
          ev.writeVarintField(1, -60);
          ev.writeVarintField(2, 1791050850);
        }, null);
        st.writeStringField(4, "stop_298_63019");
      }, null);
      tu.writeMessage(2, (___: unknown, st: PbfWriter) => {
        st.writeMessage(2, (____: unknown, ev: PbfWriter) => ev.writeVarintField(2, 1791050910), null);
        st.writeStringField(4, "stop_300_63419");
        st.writeVarintField(5, 1);
      }, null);
      tu.writeMessage(3, (___: unknown, v: PbfWriter) => {
        v.writeStringField(1, "401");
        v.writeStringField(2, "HL401");
        v.writeVarintField(4, 2);
      }, null);
    }, null);
  }, null);
  pbf.writeMessage(2, (_: unknown, p: PbfWriter) => {
    p.writeStringField(1, "vehicle_PA147");
    p.writeMessage(4, (__: unknown, vp: PbfWriter) => {
      vp.writeMessage(1, (___: unknown, trip: PbfWriter) => trip.writeStringField(1, "20260930_2_128804792_15"), null);
      vp.writeVarintField(5, 1791050900);
      vp.writeMessage(8, (___: unknown, v: PbfWriter) => v.writeStringField(2, "147"), null);
    }, null);
  }, null);
  return pbf.finish();
}

describe("decodeFeed", () => {
  it("reads trip updates, stop times, vehicles and the feed time", () => {
    // GIVEN a feed with one trip update and one vehicle position
    const bytes = encodeFeed();

    // WHEN it is decoded
    const feed = decodeFeed(bytes);

    // THEN every field the departures use comes out, including a negative delay and a skipped stop
    expect(feed.timestamp).toBe(1791050783);
    expect(feed.tripUpdates).toEqual([
      {
        trip: { tripId: "block_109_trip_19_service_2", routeId: "route_8" },
        stopTimes: [
          { stopId: "stop_298_63019", departure: 1791050850, delaySeconds: -60, scheduleRelationship: 0 },
          { stopId: "stop_300_63419", arrival: 1791050910, scheduleRelationship: 1 },
        ],
        vehicle: { id: "401", label: "HL401", wheelchair: 2 },
      },
    ]);
    expect(feed.vehicles).toEqual([
      { trip: { tripId: "20260930_2_128804792_15" }, timestamp: 1791050900, vehicle: { label: "147" } },
    ]);
  });

  it("throws on bytes that are not a feed", () => {
    // GIVEN an HTML error page instead of a feed
    const bytes = strToU8("<html>Przerwa techniczna</html>");

    // WHEN / THEN decoding fails instead of returning an empty feed
    expect(() => decodeFeed(bytes)).toThrow();
  });
});

describe("static GTFS", () => {
  it("parses quoted CSV fields with commas, quotes and CRLF", () => {
    // GIVEN a CSV with a BOM, quoted commas and doubled quotes
    const csv = '﻿stop_id,stop_name\r\n1,"Rondo Mogilskie, peron"\r\n2,"Plac ""Wolnica"""\r\n';

    // WHEN it is parsed
    const rows = parseCsv(csv);

    // THEN fields keep their text
    expect(rows).toEqual([
      { stop_id: "1", stop_name: "Rondo Mogilskie, peron" },
      { stop_id: "2", stop_name: 'Plac "Wolnica"' },
    ]);
  });

  it("reads stops, routes and trips from a zip and skips stations and rows without coordinates", () => {
    // GIVEN a GTFS zip like ZTP's
    const zip = zipSync({
      "stops.txt": strToU8(
        "stop_id,stop_code,stop_name,stop_desc,stop_lat,stop_lon,location_type\n" +
          'stop_43_6119,113-01,"Teatr Bagatela","01",50.0636,19.9333,0\n' +
          "station_1,,Dworzec,,50.06,19.94,1\n" +
          "broken,,Bez współrzędnych,,,,0\n",
      ),
      "routes.txt": strToU8('route_id,route_short_name,route_type\nroute_2,"8",900\n'),
      "trips.txt": strToU8("trip_id,route_id,trip_headsign\nblock_12_trip_7_service_2,route_2,Borek Fałęcki\n"),
      "stop_times.txt": strToU8("never read"),
    });

    // WHEN the zip is read
    const data = readGtfsZip(zip);

    // THEN only boardable stops come out, with their platform number
    expect(data).toEqual(
      buildStatic({
        "stops.txt": 'stop_id,stop_name,stop_desc,stop_lat,stop_lon\nstop_43_6119,Teatr Bagatela,01,50.0636,19.9333\n',
        "routes.txt": "route_id,route_short_name\nroute_2,8\n",
        "trips.txt": "trip_id,route_id,trip_headsign\nblock_12_trip_7_service_2,route_2,Borek Fałęcki\n",
      }),
    );
    expect(data.stops).toEqual([{ id: "stop_43_6119", name: "Teatr Bagatela", platform: "01", lat: 50.0636, lon: 19.9333 }]);
    expect(data.routes).toEqual({ route_2: "8" });
    expect(data.trips).toEqual({ block_12_trip_7_service_2: ["route_2", "Borek Fałęcki"] });
  });

  it("refuses a zip without the tables it needs", () => {
    // GIVEN a zip with only stops
    const zip = zipSync({ "stops.txt": strToU8("stop_id\n") });

    // WHEN / THEN reading it fails loudly
    expect(() => readGtfsZip(zip)).toThrow(/routes\.txt, trips\.txt/);
  });
});
