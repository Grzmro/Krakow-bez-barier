import { defineConfig } from "@playwright/test";
import { worktreePort } from "./playwright.config";

// `npm run demo:record` — records the 3-minute demo walkthrough (docs/demo-script.md) as a video.
// Not part of `test:e2e`: it runs against a production build of this worktree, or against a
// deployed app when E2E_BASE_URL is set.
const port = Number(process.env.PORT ?? worktreePort(__dirname) + 2000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e/demo",
  testMatch: "record-demo.ts",
  outputDir: "test-results/demo",
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 300_000,
  use: { browserName: "chromium", baseURL, actionTimeout: 15_000 },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npm run start -- --port ${port}`,
        url: baseURL,
        reuseExistingServer: false,
        // The walkthrough opens the mock API's sample places by id; a real-data build has none of them.
        env: { NEXT_PUBLIC_API_MOCK: "true" },
        timeout: 300_000,
      },
});
