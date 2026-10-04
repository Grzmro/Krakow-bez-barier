import { describe, expect, it } from "vitest";
import { contributorToken } from "./contributor-token";

const memoryStorage = () => {
  const items = new Map<string, string>();
  return { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v), items };
};

describe("contributorToken", () => {
  it("generates a random token once and keeps it in the browser", () => {
    // GIVEN empty storage
    const storage = memoryStorage();

    // WHEN the token is asked for twice
    const first = contributorToken(storage);
    const second = contributorToken(storage);

    // THEN it is one spec-valid random token, stored under kbb-contributor
    expect(first).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    expect(second).toBe(first);
    expect(storage.items.get("kbb-contributor")).toBe(first);
  });

  it("replaces a stored value that isn't a valid token", () => {
    // GIVEN storage holding something else under the key
    const storage = memoryStorage();
    storage.setItem("kbb-contributor", "<tampered>");

    // WHEN the token is asked for
    // THEN a valid token is returned and stored
    expect(contributorToken(storage)).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    expect(storage.items.get("kbb-contributor")).toMatch(/^[0-9a-f]{32}$/);
  });

  it("still works when storage throws (private mode)", () => {
    // GIVEN storage that refuses access
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };

    // WHEN the token is asked for twice
    // THEN the same session token comes back
    const token = contributorToken(broken);
    expect(token).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    expect(contributorToken(broken)).toBe(token);
  });
});
