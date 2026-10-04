import { describe, expect, it } from "vitest";
import { contributorToken, storedContributorToken } from "./contributor-token";

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

  it("reads a stored token without creating one", () => {
    // GIVEN empty storage, then one holding a token
    const empty = memoryStorage();
    const filled = memoryStorage();
    filled.setItem("kbb-contributor", "0123456789abcdef0123456789abcdef");

    // WHEN reading the stored token
    // THEN nothing is created for the empty one, and the stored token is returned for the other
    storedContributorToken(empty);
    expect(empty.items.size).toBe(0);
    expect(storedContributorToken(filled)).toBe("0123456789abcdef0123456789abcdef");
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
