import { defineConfig } from "@playwright/test";
import { worktreePort } from "./playwright.config";

// `npm run demo:video` — records the picture of the final voiced video (docs/demo-script.md → "Wideo z lektorem").
// Real data only: a production build of this worktree on the database in DATABASE_URL, or a running app given in
// E2E_BASE_URL. Routes come from the recorded openrouteservice answers (no ORS_API_KEY needed for Dworzec Główny → Rynek).
const port = Number(process.env.PORT ?? worktreePort(__dirname) + 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

if (!process.env.E2E_BASE_URL && !process.env.DATABASE_URL) {
  throw new Error("demo:video records real places: set DATABASE_URL (a throwaway database with the ingest loaded) or E2E_BASE_URL.");
}

export default defineConfig({
  testDir: "e2e/demo",
  testMatch: "record-final.ts",
  outputDir: "test-results/demo-video",
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 420_000,
  use: { browserName: "chromium", baseURL, actionTimeout: 20_000 },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npm run start -- --port ${port}`,
        url: baseURL,
        reuseExistingServer: false,
        // NEXT_PUBLIC_API_MOCK is inlined at build time; empty so a stray value can't build the example-data app.
        env: { NEXT_PUBLIC_API_MOCK: "", ORS_API_KEY: "" },
        timeout: 300_000,
      },
});
