import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

const isCI = !!process.env.CI;

// Parallel agents run e2e in separate git worktrees; a shared default port would let one worktree's
// tests hit another worktree's dev server. Derive a stable per-worktree port instead.
export function worktreePort(dir: string): number {
  let hash = 0;
  for (const char of dir) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return 3100 + (hash % 800);
}

const port = Number(process.env.PORT ?? (isCI ? 3000 : worktreePort(__dirname)));
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

// Offline specs (*.prod.spec.ts) need the production service worker setup — the dev client doesn't
// hydrate offline. They run only on request (E2E_PROD=1, set by scripts/merge-pr.sh right after its
// build) against `next start` of the current build, or against E2E_PROD_BASE_URL.
const prodPort = port + 1000;
const prodURL = process.env.E2E_PROD_BASE_URL ?? (isCI ? baseURL : `http://localhost:${prodPort}`);
const runProdSpecs = process.env.E2E_PROD === "1" || !!process.env.E2E_PROD_BASE_URL;
const startProdServer = runProdSpecs && !isCI && !process.env.E2E_PROD_BASE_URL;

const device = { ...devices["Pixel 7"], browserName: "chromium" as const };
// Routes come from the recorded openrouteservice answers, never the live API (the root .env may hold a key).
const env = { ORS_API_KEY: "" };
const servers: PlaywrightTestConfig["webServer"] = [
  ...(process.env.E2E_BASE_URL
    ? []
    : [
        {
          command: isCI ? `npm run start -- --port ${port}` : `npm run dev -- --port ${port}`,
          url: baseURL,
          reuseExistingServer: !isCI,
          timeout: 60_000,
          env,
        },
      ]),
  ...(startProdServer
    ? [{ command: `npm run start -- --port ${prodPort}`, url: prodURL, reuseExistingServer: false, timeout: 60_000, env }]
    : []),
];

// Fast by design: one browser, parallel files, no retries. CI runs against the production build
// made earlier in the same job (`next start`); locally it reuses this worktree's dev server.
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
  projects: [
    { name: "chromium", testIgnore: /\.prod\.spec\.ts$/, use: device },
    ...(runProdSpecs ? [{ name: "chromium-prod", testMatch: /\.prod\.spec\.ts$/, use: { ...device, baseURL: prodURL } }] : []),
  ],
  webServer: servers,
});
