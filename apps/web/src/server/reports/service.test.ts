import { describe, expect, it } from "vitest";
import { HttpError } from "@/server/http";
import { createMemoryReportsStore } from "./memory-store";
import { checkReportValue, decodeCursor, encodeCursor, pendingReportsByAttribute, redactContactData } from "./service";

describe("redactContactData", () => {
  it("removes e-mail addresses and phone numbers but keeps measurements", () => {
    // GIVEN a comment with contact data next to ordinary numbers
    const comment = "Drzwi 90 cm, 2 stopnie. Pisz: jan.kowalski@example.pl lub +48 600 123 456, tel. 12-345-67-89";

    // WHEN it is redacted
    const result = redactContactData(comment);

    // THEN only the contact data is gone
    expect(result).toBe("Drzwi 90 cm, 2 stopnie. Pisz: [usunięto] lub [usunięto], tel. [usunięto]");
  });
});

describe("checkReportValue", () => {
  const rejects = (fn: () => unknown, field: string) => {
    try {
      fn();
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).problem).toMatchObject({ status: 422, errors: [expect.objectContaining({ field })] });
      return;
    }
    throw new Error("expected a 422");
  };

  it("accepts a value within the attribute's range and fills in its unit", () => {
    // WHEN a door width of 90 is reported without a unit
    const value = checkReportValue("door_width_cm", { kind: "number", number: 90 });

    // THEN it is accepted in cm
    expect(value).toEqual({ kind: "number", number: 90, unit: "cm" });
  });

  it("rejects values outside the range, of the wrong kind, unit or precision", () => {
    // WHEN values break each rule
    // THEN each is a 422 naming the field
    rejects(() => checkReportValue("door_width_cm", { kind: "number", number: 5, unit: "cm" }), "value.number");
    rejects(() => checkReportValue("door_width_cm", { kind: "number", number: 301 }), "value.number");
    rejects(() => checkReportValue("door_width_cm", { kind: "boolean", boolean: true }), "value.kind");
    rejects(() => checkReportValue("door_width_cm", { kind: "number", number: 90, unit: "m" }), "value.unit");
    rejects(() => checkReportValue("step_count", { kind: "number", number: 1.5 }), "value.number");
    rejects(() => checkReportValue("lift", { kind: "number", number: 1 }), "value.kind");
    rejects(() => checkReportValue("surface", { kind: "text", text: " " }), "value.text");
  });

  it("accepts the range bounds and non-numeric attributes", () => {
    // WHEN bounds and a boolean are reported
    // THEN they pass unchanged
    expect(checkReportValue("door_width_cm", { kind: "number", number: 10 })).toMatchObject({ number: 10 });
    expect(checkReportValue("door_width_cm", { kind: "number", number: 300 })).toMatchObject({ number: 300 });
    expect(checkReportValue("lift", { kind: "boolean", boolean: false })).toEqual({ kind: "boolean", boolean: false });
  });
});

describe("queue cursor", () => {
  it("round-trips and rejects garbage with a 400", () => {
    // GIVEN a cursor
    const cursor = { createdAt: new Date("2026-10-03T09:00:00Z"), id: "abc" };

    // WHEN it is encoded and decoded, and a forged one is decoded
    // THEN the first survives and the second is a 400
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    expect(() => decodeCursor("not-a-cursor")).toThrow(HttpError);
  });
});

describe("pendingReportsByAttribute", () => {
  it("groups reports awaiting moderation by attribute", async () => {
    // GIVEN a place with two pending reports
    const { store } = createMemoryReportsStore({ places: [{ id: "p1", name: "Muzeum" }] });
    await store.insertReport({ placeId: "p1", attribute: "lift", value: { kind: "boolean", boolean: false }, comment: null });
    await store.insertReport({ placeId: "p1", attribute: "step_count", value: { kind: "number", number: 2, unit: "count" }, comment: null });

    // WHEN they are grouped
    const grouped = await pendingReportsByAttribute(store, "p1");

    // THEN each attribute lists its unverified report
    expect(grouped.get("lift")).toEqual([expect.objectContaining({ status: "new", value: { kind: "boolean", boolean: false } })]);
    expect(grouped.get("step_count")).toHaveLength(1);
  });
});
