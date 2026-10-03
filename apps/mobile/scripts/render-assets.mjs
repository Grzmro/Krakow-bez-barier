// Renders the "Fiolet" app icons and splash screens from the LogoMark glyph
// (packages/ui/src/kbb/logo-mark.tsx) into the iOS and Android projects. Run after a logo change:
// `npm run assets -w apps/mobile`. Needs `rsvg-convert` (brew install librsvg) and macOS `sips`;
// the PNGs are committed, so nobody else needs these tools.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const VIOLET = "#5b3df5";
const WHITE = "#ffffff";
const BLUSH = "#ffb8d9";
const ROOT = path.join(import.meta.dirname, "..");
const IOS = path.join(ROOT, "ios", "App", "App", "Assets.xcassets");
const ANDROID = path.join(ROOT, "android", "app", "src", "main", "res");

// The LogoMark's glyph without its rounded tile (the OS masks icons itself), in a 32×32 box.
const GLYPH = `
  <path d="M9 21.5c3-6.5 7.5-10 14-11" stroke="${WHITE}" stroke-width="3" stroke-linecap="round" fill="none"/>
  <circle cx="9.5" cy="21.5" r="3" fill="${BLUSH}"/>
  <circle cx="23" cy="10.5" r="3" fill="${WHITE}"/>`;

/**
 * @param {number} width
 * @param {number} height
 * @param {number} glyphShare glyph box size as a share of the shorter side
 * @param {"square" | "circle" | "none"} background
 */
function svg(width, height, glyphShare, background) {
  const g = Math.min(width, height) * glyphShare;
  const bg = {
    square: `<rect width="${width}" height="${height}" fill="${VIOLET}"/>`,
    circle: `<circle cx="${width / 2}" cy="${height / 2}" r="${width / 2}" fill="${VIOLET}"/>`,
    none: "",
  }[background];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${bg}
  <g transform="translate(${(width - g) / 2} ${(height - g) / 2}) scale(${g / 32})">${GLYPH}</g>
</svg>`;
}

const tmp = mkdtempSync(path.join(tmpdir(), "kbb-assets-"));
let n = 0;

/** Renders to `out`; `opaque` drops the alpha channel (required for App Store icons). */
function render(out, [width, height, glyphShare, background], opaque = false) {
  const svgFile = path.join(tmp, `${n++}.svg`);
  writeFileSync(svgFile, svg(width, height, glyphShare, background));
  if (!opaque) {
    execFileSync("rsvg-convert", ["-o", out, svgFile]);
  } else {
    const rgba = `${svgFile}.png`;
    const jpg = `${svgFile}.jpg`;
    execFileSync("rsvg-convert", ["-o", rgba, svgFile]);
    execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "100", rgba, "--out", jpg], { stdio: "ignore" });
    execFileSync("sips", ["-s", "format", "png", jpg, "--out", out], { stdio: "ignore" });
  }
  console.log(`wrote ${path.relative(ROOT, out)}`);
}

// iOS
render(path.join(IOS, "AppIcon.appiconset", "AppIcon-512@2x.png"), [1024, 1024, 0.95, "square"], true);
for (const suffix of ["", "-1", "-2"]) {
  render(path.join(IOS, "Splash.imageset", `splash-2732x2732${suffix}.png`), [2732, 2732, 0.3, "square"], true);
}

// Android: legacy + round launcher icons, adaptive foreground (glyph inside the 66/108 safe zone)
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [density, scale] of Object.entries(DENSITIES)) {
  const dir = path.join(ANDROID, `mipmap-${density}`);
  const icon = 48 * scale;
  const foreground = 108 * scale;
  render(path.join(dir, "ic_launcher.png"), [icon, icon, 0.95, "square"]);
  render(path.join(dir, "ic_launcher_round.png"), [icon, icon, 0.95, "circle"]);
  render(path.join(dir, "ic_launcher_foreground.png"), [foreground, foreground, 0.6, "none"]);
}

// Android splash: same sizes as the Capacitor template
const SPLASH_PORTRAIT = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
render(path.join(ANDROID, "drawable", "splash.png"), [480, 320, 0.3, "square"]);
for (const [density, [w, h]] of Object.entries(SPLASH_PORTRAIT)) {
  render(path.join(ANDROID, `drawable-port-${density}`, "splash.png"), [w, h, 0.3, "square"]);
  render(path.join(ANDROID, `drawable-land-${density}`, "splash.png"), [h, w, 0.3, "square"]);
}
