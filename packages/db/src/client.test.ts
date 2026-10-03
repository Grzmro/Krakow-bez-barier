import { describe, expect, it } from "vitest";
import { normalizeDatabaseUrl } from "./client";

describe("normalizeDatabaseUrl", () => {
  it("drops channel_binding but keeps sslmode and the rest of the URL", () => {
    // GIVEN a connection string as Neon's dialog prints it
    const url = "postgresql://user:p%40ss@ep-cool-123-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

    // WHEN normalizing it
    const normalized = new URL(normalizeDatabaseUrl(url));

    // THEN only channel_binding is gone
    expect(normalized.searchParams.get("channel_binding")).toBeNull();
    expect(normalized.searchParams.get("sslmode")).toBe("require");
    expect(normalized.host).toBe("ep-cool-123-pooler.eu-central-1.aws.neon.tech");
    expect(normalized.password).toBe("p%40ss");
  });

  it("leaves a plain local URL unchanged", () => {
    // GIVEN the docker-compose URL WHEN normalizing THEN nothing changes
    expect(normalizeDatabaseUrl("postgres://kbb:kbb@localhost:5432/kbb")).toBe("postgres://kbb:kbb@localhost:5432/kbb");
  });
});
