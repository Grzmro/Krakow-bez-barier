import { describe, expect, it } from "vitest";
import { noIndex } from "../../next.config";
import robots from "./robots";

describe("keeping the demo out of search engines", () => {
  it("disallows every crawler in robots.txt and sends noindex on every response", () => {
    // GIVEN the robots route and the global header rule
    // WHEN reading them
    const rules = robots().rules;

    // THEN crawlers are told to stay out of the whole site and the header says noindex
    expect(rules).toEqual({ userAgent: "*", disallow: "/" });
    expect(noIndex).toEqual([{ key: "X-Robots-Tag", value: "noindex, nofollow" }]);
  });
});
