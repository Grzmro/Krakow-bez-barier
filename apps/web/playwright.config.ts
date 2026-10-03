import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

const isCI = !!process.env.CI;

// Parallel agents run e2e in separate git worktrees; a shared default port would let one worktree's
// tests hit another worktree's dev server. Derive a stable per-worktree port instead.
function worktreePort(dir: string): number {
  let hash = 0;
  for (const char of dir) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return 3100 + (hash % 800);
}

const port = Number(process.env.PORT ?? (isCI ? 3000 : worktreePort(__dirname)));
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

// Offline specs (*.prod.spec.ts) need the production service worker setup — the dev client doesn't
// hydrate offline. Locally they run against `next start` of the last `npm run build` (the merge gate
// builds right before e2e); without a build they're skipped with a warning.
const prodPort = port + 1000;
const hasBuild = existsSync(path.join(__dirname, ".next", "BUILD_ID"));
const prodURL = process.env.E2E_BASE_URL ?? (isCI ? baseURL : `http://localhost:${prodPort}`);
const runProdSpecs = isCI || !!process.env.E2E_BASE_URL || hasBuild;
if (!runProdSpecs) console.warn("e2e: no production build — skipping *.prod.spec.ts (run `npm run build` first)");

const device = { ...devices["Pixel 7"], browserName: "chromium" as const };
const servers: PlaywrightTestConfig["webServer"] = [
  {
    command: isCI ? `npm run start -- --port ${port}` : `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
  ...(runProdSpecs && !isCI
    ? [{ command: `npm run start -- --port ${prodPort}`, url: prodURL, reuseExistingServer: false, timeout: 60_000 }]
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
  webServer: process.env.E2E_BASE_URL ? undefined : servers,
});
