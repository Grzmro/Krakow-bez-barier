import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

function tokens(selector: ":root" | ".dark"): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  const block = css.slice(start, css.indexOf("\n}", start));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2]]));
}

type Rgb = [number, number, number];

const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;

const mix = (fg: Rgb, bg: Rgb, alpha: number): Rgb => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha)) as Rgb;

function luminance([r, g, b]: Rgb) {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground token, background token, foreground alpha]
type Pair = [string, string, number?];

const TEXT: Pair[] = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["foreground", "muted"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["primary-foreground", "primary"],
  ["primary", "background"],
  ["primary", "card"],
  ["secondary-foreground", "secondary"],
  ["ink-foreground", "ink"],
  ["destructive", "background"],
  ["foreground", "card", 0.7], // SampleTag text
  ...(["met", "barrier", "conflict", "unknown"] as const).flatMap((s): Pair[] => [
    [`status-${s}`, `status-${s}-bg`],
    [`status-${s}`, "card"],
    [`status-${s}`, "muted"],
  ]),
];

const NON_TEXT: Pair[] = [
  ["ring", "background"],
  ["ring", "card"],
  ["border-strong", "card"],
  ["status-unknown", "status-unknown-bg"], // dashed "Brak danych" outline
];

describe.each([":root", ".dark"] as const)("Fiolet tokens in %s", (selector) => {
  const t = tokens(selector);

  it.each(TEXT)("text %s on %s meets 4.5:1", (fg, bg, alpha = 1) => {
    // GIVEN a text colour pair used by the components
    const back = rgb(t[bg]);
    const front = mix(rgb(t[fg]), back, alpha);

    // WHEN its contrast is computed
    const r = ratio(front, back);

    // THEN it meets WCAG AA for normal text
    expect(r).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NON_TEXT)("UI %s on %s meets 3:1", (fg, bg) => {
    // GIVEN a focus ring, border or status outline
    // WHEN its contrast against the surface is computed
    const r = ratio(rgb(t[fg]), rgb(t[bg]));

    // THEN it meets WCAG AA for non-text contrast
    expect(r).toBeGreaterThanOrEqual(3);
  });
});
