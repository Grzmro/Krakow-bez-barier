// Renders the "Fiolet" app icons (PWA manifest + apple-touch-icon) to PNG with Playwright's Chromium.
// Colors come from the light-theme tokens in packages/ui. Rerun after changing the mark or tokens:
//   node apps/web/scripts/generate-icons.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "..", "public", "icons");
const css = readFileSync(path.join(here, "..", "..", "..", "packages", "ui", "src", "styles.css"), "utf8");

function token(name) {
  const root = css.slice(css.indexOf("\n:root {"));
  const match = root.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, "i"));
  if (!match) throw new Error(`token --${name} not found`);
  return match[1];
}

const primary = token("primary");
const onPrimary = token("primary-foreground");
const blush = token("blush");

// Same mark as LogoMark (32×32 viewBox). `scale` shrinks it around the centre — maskable icons keep
// the mark inside the 80% safe zone; `radius` rounds the background for "any" icons.
function svg({ size, scale, radius }) {
  const offset = 16 - 16 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${radius}" fill="${primary}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="M9 21.5c3-6.5 7.5-10 14-11" stroke="${onPrimary}" stroke-width="3" stroke-linecap="round" fill="none"/>
    <circle cx="9.5" cy="21.5" r="3" fill="${blush}"/>
    <circle cx="23" cy="10.5" r="3" fill="${onPrimary}"/>
  </g>
</svg>`;
}

const ICONS = [
  { file: "icon-192.png", size: 192, scale: 0.9, radius: 7 },
  { file: "icon-512.png", size: 512, scale: 0.9, radius: 7 },
  { file: "icon-maskable-512.png", size: 512, scale: 0.65, radius: 0 },
  { file: "apple-touch-icon.png", size: 180, scale: 0.75, radius: 0 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const icon of ICONS) {
  await page.setViewportSize({ width: icon.size, height: icon.size });
  await page.setContent(`<body style="margin:0;background:transparent">${svg(icon)}</body>`);
  await page.locator("svg").screenshot({ path: path.join(outDir, icon.file), omitBackground: true });
  console.log(`wrote ${icon.file}`);
}
await browser.close();
