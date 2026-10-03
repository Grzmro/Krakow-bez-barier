import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;
const isCI = !!process.env.CI;

// Fast by design: one browser, parallel files, no retries. CI runs against the production build
// made earlier in the same job (`next start`); locally it reuses a running dev server.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [["github"], ["list"]] : "list",
  timeout: 15_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Pixel 7"], browserName: "chromium" } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: isCI ? `npm run start -- --port ${port}` : `npm run dev -- --port ${port}`,
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 60_000,
      },
});
