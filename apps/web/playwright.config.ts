import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

// Same root .env the app loads (next.config.ts), so specs see DATABASE_URL exactly when the server does.
const rootEnv = path.join(__dirname, "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

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

// *.prod.spec.ts run against `next start` of the current build, which uses the real API: the offline specs need the
// production service worker (the dev client doesn't hydrate offline), the real-data specs need the database and
// skip themselves when DATABASE_URL is unset. They run only on request (E2E_PROD=1, set by scripts/merge-pr.sh after its build when a prod spec is selected)
// or against E2E_PROD_BASE_URL.
const prodPort = port + 1000;
const prodURL = process.env.E2E_PROD_BASE_URL ?? `http://localhost:${prodPort}`;
const runProdSpecs = process.env.E2E_PROD === "1" || !!process.env.E2E_PROD_BASE_URL;
const startProdServer = runProdSpecs && !process.env.E2E_PROD_BASE_URL;

const device = { ...devices["Pixel 7"], browserName: "chromium" as const };
// Routes come from the recorded openrouteservice answers, never the live API (the root .env may hold a key).
const env = { ORS_API_KEY: "" };
// The dev-server specs open the openapi.yaml sample places by id, so that server answers from the examples.
// It must be `next dev` (also in CI): NEXT_PUBLIC_API_MOCK is inlined at build time, so `next start` of the
// real-API build would ignore it. A reused dev server started without it serves real data and these specs fail.
const devEnv = { ...env, NEXT_PUBLIC_API_MOCK: "true" };
const servers: PlaywrightTestConfig["webServer"] = [
  ...(process.env.E2E_BASE_URL
    ? []
    : [
        {
          command: `npm run dev -- --port ${port}`,
          url: baseURL,
          reuseExistingServer: !isCI,
          timeout: 60_000,
          env: devEnv,
        },
      ]),
  ...(startProdServer
    ? [{ command: `npm run start -- --port ${prodPort}`, url: prodURL, reuseExistingServer: false, timeout: 60_000, env }]
    : []),
];

// Parallel agents share one machine: an uncapped run starts a browser per core and starves the others.
// E2E_WORKERS takes a count or a share of the cores ("50%").
const e2eWorkers = process.env.E2E_WORKERS?.trim();
const localWorkers = !e2eWorkers ? 3 : /^\d+$/.test(e2eWorkers) ? Number(e2eWorkers) || 3 : e2eWorkers;

// Fast by design: one browser, parallel files, no retries. Locally it reuses this worktree's dev server.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0,
  workers: isCI ? 2 : localWorkers,
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
