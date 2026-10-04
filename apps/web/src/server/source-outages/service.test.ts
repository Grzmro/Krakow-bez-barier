import { describe, expect, it, vi } from "vitest";
import { createMemorySourceOutagesStore } from "./memory-store";
import { currentSimulatedOutageIds, startSimulation } from "./service";
import type { SourceOutagesStore } from "./store";

const anna = { name: "anna", demo: false };
const seed = () =>
  createMemorySourceOutagesStore({
    sources: [
      { id: "msip", name: "MSIP" },
      { id: "osm", name: "OpenStreetMap", kind: "community" },
    ],
  });

describe("currentSimulatedOutageIds", () => {
  it("joins the operator's config and the moderators' running simulations, once each", async () => {
    // GIVEN `SIMULATE_SOURCE_OUTAGE=osm` and running simulations of msip and osm
    const { store } = seed();
    const now = new Date("2026-10-04T09:00:00Z");
    await startSimulation(store, "msip", anna, now);
    await startSimulation(store, "osm", anna, now);

    // WHEN the current outages are read
    const ids = await currentSimulatedOutageIds(() => store, now, ["osm"], true);

    // THEN both sources are listed once
    expect(ids.toSorted()).toEqual(["msip", "osm"]);
  });

  it("leaves out a simulation once it has ended by itself", async () => {
    // GIVEN a simulation started 15 minutes ago
    const { store } = seed();
    await startSimulation(store, "msip", anna, new Date("2026-10-04T09:00:00Z"));

    // WHEN read at 9:14 and at 9:15
    const before = await currentSimulatedOutageIds(() => store, new Date("2026-10-04T09:14:59Z"), [], true);
    const after = await currentSimulatedOutageIds(() => store, new Date("2026-10-04T09:15:00Z"), [], true);

    // THEN it counts until its end only
    expect(before).toEqual(["msip"]);
    expect(after).toEqual([]);
  });

  it("falls back to the config when the database can't be read, and skips it when none is configured", async () => {
    // GIVEN a store whose read fails (e.g. the migration is not applied yet)
    const broken: SourceOutagesStore = { ...seed().store, listRunning: () => Promise.reject(new Error("relation does not exist")) };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const unused = vi.fn(() => broken);

    // WHEN the current outages are read with and without a database
    const failed = await currentSimulatedOutageIds(() => broken, new Date(), ["osm"], true);
    const noDb = await currentSimulatedOutageIds(unused, new Date(), ["osm"], false);

    // THEN only the config counts, the failure is logged and without a database the store is not even asked
    expect(failed).toEqual(["osm"]);
    expect(noDb).toEqual(["osm"]);
    expect(error).toHaveBeenCalled();
    expect(unused).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
