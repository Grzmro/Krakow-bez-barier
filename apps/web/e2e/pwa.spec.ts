import { expect, test } from "./fixtures";

test("web app manifest makes the app installable", async ({ request }) => {
  // GIVEN the manifest Next.js serves for app/manifest.ts
  // WHEN fetching it
  const response = await request.get("/manifest.webmanifest");

  // THEN it has what Chrome needs to install the app, in Polish, with the Fiolet colors
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: "Kraków bez barier",
    short_name: "Bez barier",
    lang: "pl",
    start_url: "/",
    display: "standalone",
    theme_color: "#5b3df5",
    background_color: "#faf8f5",
  });
  const sizes = manifest.icons.map((icon: { sizes: string; purpose: string }) => `${icon.sizes} ${icon.purpose}`);
  expect(sizes).toEqual(expect.arrayContaining(["192x192 any", "512x512 any", "512x512 maskable"]));
  for (const icon of [...manifest.icons, { src: "/icons/apple-touch-icon.png" }]) {
    const image = await request.get(icon.src);
    expect(image.headers()["content-type"], icon.src).toBe("image/png");
  }
});
