import { defineConfig } from "@playwright/test";
import { worktreePort } from "./playwright.config";

// `npm run demo:record` — records the 3-minute demo walkthrough (docs/demo-script.md) as a video, on real data:
// a production build of this worktree on the real API and the database in DATABASE_URL (playwright.config.ts loads
// the root .env). Not part of `test:e2e`. With E2E_BASE_URL it records a deployed app instead.
const port = Number(process.env.PORT ?? worktreePort(__dirname) + 2000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;
// The "source unavailable" scene needs the operator's outage switch (SIMULATE_SOURCE_OUTAGE). Locally a second
// `next start` of the same build and database runs with it; for a deployed app pass DEMO_OUTAGE_BASE_URL.
const outagePort = port + 1;
const outageURL = process.env.DEMO_OUTAGE_BASE_URL ?? (process.env.E2E_BASE_URL ? "" : `http://localhost:${outagePort}`);
process.env.DEMO_OUTAGE_BASE_URL = outageURL;

if (!process.env.E2E_BASE_URL && !process.env.DATABASE_URL) {
  throw new Error(
    "demo:record records real places, so it needs a database: set DATABASE_URL in the root .env, " +
      "then run `npm run db:setup` and `npm run ingest -- --source osm`. It never falls back to the mock API.",
  );
}

// NEXT_PUBLIC_API_MOCK is inlined at build time; set empty so a stray value in the shell can't build the mock app.
// Routes come from the recorded openrouteservice answers, never the live API.
const env = { NEXT_PUBLIC_API_MOCK: "", ORS_API_KEY: "" };

export default defineConfig({
  testDir: "e2e/demo",
  testMatch: "record-demo.ts",
  outputDir: "test-results/demo",
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 300_000,
  use: { browserName: "chromium", baseURL, actionTimeout: 15_000 },
  // Started one after the other, so the outage server reuses the build the first one made.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: `npm run build && npm run start -- --port ${port}`,
          url: baseURL,
          reuseExistingServer: false,
          env,
          timeout: 300_000,
        },
        {
          command: `npm run start -- --port ${outagePort}`,
          url: outageURL,
          reuseExistingServer: false,
          env: { ...env, SIMULATE_SOURCE_OUTAGE: "msip-toilets", ALLOW_SIMULATED_OUTAGE: "true" },
          timeout: 60_000,
        },
      ],
});
