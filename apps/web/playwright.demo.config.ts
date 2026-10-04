import { defineConfig } from "@playwright/test";
import { worktreePort } from "./playwright.config";

// `npm run demo:record` — records the 3-minute demo video (docs/demo-script.md → "Wideo do zgłoszenia"). Not part of
// `test:e2e`. Two servers:
// - real data: a production build of this worktree on the database in DATABASE_URL (playwright.config.ts loads the
//   root .env), or a running app given in E2E_BASE_URL. The recording only reads from it.
// - sample data: `next dev` with the example API (NEXT_PUBLIC_API_MOCK), or DEMO_SAMPLE_BASE_URL. The scenes that
//   write (a report, the demo moderator's approval, the source-outage switch) run here, labelled PRZYKŁAD, so the
//   recording never leaves anything behind in a shared database.
// The stage page lives on the real server's origin and frames the sample server: with an https E2E_BASE_URL, a
// DEMO_SAMPLE_BASE_URL on plain http (other than localhost) is blocked as mixed content.
const port = Number(process.env.PORT ?? worktreePort(__dirname) + 2000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;
// The same port and env as the dev server of `npm run test:e2e` (playwright.config.ts): Next.js allows one `next dev`
// per app directory, so the recording reuses that server when it runs instead of failing to start a second one.
const samplePort = worktreePort(__dirname);
const startSampleServer = !process.env.DEMO_SAMPLE_BASE_URL;
const sampleURL = process.env.DEMO_SAMPLE_BASE_URL ?? `http://localhost:${samplePort}`;
process.env.DEMO_SAMPLE_BASE_URL = sampleURL;

if (!process.env.E2E_BASE_URL && (!process.env.DATABASE_URL || !process.env.ORS_API_KEY)) {
  throw new Error(
    "demo:record records real places and a real route, so the build it starts needs DATABASE_URL and ORS_API_KEY " +
      "in the root .env (then `npm run db:setup` and the ingest, docs/demo-script.md), or point E2E_BASE_URL at a running app.",
  );
}

// NEXT_PUBLIC_API_MOCK is inlined at build time; set empty so a stray value in the shell can't build the mock app.
const realEnv = { NEXT_PUBLIC_API_MOCK: "" };
// The sample server answers from the openapi.yaml examples and the recorded openrouteservice answers.
const sampleEnv = { NEXT_PUBLIC_API_MOCK: "true", ORS_API_KEY: "", TRANSIT_FEED: "recorded" };

export default defineConfig({
  testDir: "e2e/demo",
  testMatch: "record-demo.ts",
  outputDir: "test-results/demo",
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 600_000,
  use: { browserName: "chromium", baseURL, actionTimeout: 20_000 },
  webServer: [
    ...(process.env.E2E_BASE_URL
      ? []
      : [
          {
            command: `npm run build && npm run start -- --port ${port}`,
            url: baseURL,
            reuseExistingServer: false,
            env: realEnv,
            timeout: 300_000,
          },
        ]),
    ...(!startSampleServer
      ? []
      : [
          {
            command: `npm run dev -- --port ${samplePort}`,
            url: sampleURL,
            reuseExistingServer: true,
            env: sampleEnv,
            timeout: 120_000,
          },
        ]),
  ],
});
