import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { brandColors } from "./brand-colors";

const css = readFileSync(path.resolve(__dirname, "../../../../../packages/ui/src/styles.css"), "utf8");

function lightToken(name: string): string | undefined {
  const start = css.indexOf("\n:root {");
  const root = css.slice(start, css.indexOf("\n}", start));
  return root.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, "i"))?.[1].toLowerCase();
}

describe("brandColors", () => {
  it("matches the light-theme tokens in packages/ui", () => {
    // GIVEN the token stylesheet
    // WHEN reading the tokens the manifest uses
    // THEN the hard-coded copies are identical
    expect(brandColors.primary).toBe(lightToken("primary"));
    expect(brandColors.background).toBe(lightToken("background"));
  });
});
