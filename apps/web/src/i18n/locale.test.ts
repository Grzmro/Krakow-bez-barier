import { describe, expect, it } from "vitest";
import { localeFromCookies, localeOf } from "./locale";

describe("localeFromCookies", () => {
  it("reads the language cookie among others", () => {
    // GIVEN a cookie header with the language set to English
    const header = "theme=dark; kbb-lang=en; other=1";
    // WHEN it is read
    // THEN English is chosen
    expect(localeFromCookies(header)).toBe("en");
  });

  it("falls back to Polish when the cookie is missing or unknown", () => {
    // GIVEN no cookie, an unrelated cookie, an unsupported language and a look-alike name
    const headers = [null, "", "theme=dark", "kbb-lang=de", "xkbb-lang=en"];
    // WHEN each is read
    // THEN the default language is used
    for (const header of headers) expect(localeFromCookies(header)).toBe("pl");
  });

  it("reads the language of a request", () => {
    // GIVEN a request carrying the language cookie
    const request = new Request("http://localhost/api/v1/places", { headers: { cookie: "kbb-lang=en" } });
    // WHEN its language is read
    // THEN it is English
    expect(localeOf(request)).toBe("en");
  });
});
