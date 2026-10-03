import { defineConfig, devices } from "@playwright/test";

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
