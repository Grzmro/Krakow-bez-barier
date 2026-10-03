import { describe, expect, it } from "vitest";
import { categories } from "@krakow-bez-barier/contracts";
import { validateResponse } from "@/server/http";
import { GET } from "./route";

describe("GET /api/v1/categories", () => {
  it("lists the configured categories in the shape the spec documents", async () => {
    // GIVEN the category config
    // WHEN categories are requested
    const res = await GET(new Request("http://localhost/api/v1/categories"));

    // THEN every configured category is returned with its Polish label and icon, without ingestion details
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(validateResponse("listCategories", 200, body)).toEqual([]);
    expect(body.items.map((c: { id: string }) => c.id)).toEqual(categories.map((c) => c.id));
    expect(body.items).toContainEqual({ id: "pharmacy", label: "Apteki", singularLabel: "Apteka", icon: "pill" });
    expect(JSON.stringify(body)).not.toContain("osm");
  });
});
