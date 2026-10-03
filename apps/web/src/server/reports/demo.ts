import type { sources } from "@krakow-bez-barier/db";
import type { ReportsStore } from "./store";

/** Name the demo account's decisions are recorded under; a `MODERATOR_TOKENS` entry can't take it. */
export const DEMO_MODERATOR_NAME = "Konto demonstracyjne";

/** The demo account's decisions, and the facts they created, are undone this long after they are made. */
export const DEMO_REVERT_MINUTES = 30;

/** The source a report accepted by the demo account is attributed to, kept apart from real moderated facts. */
export const DEMO_MODERATED_SOURCE = {
  id: "community-moderated-demo",
  name: "Konto demonstracyjne moderatora (zmiana tymczasowa)",
  kind: "user_report",
  license: `Not open data: a demo-account decision, undone automatically after ${DEMO_REVERT_MINUTES} minutes`,
  attribution: "Użytkownicy Kraków bez barier",
  refreshInterval: "continuous",
  baseReliability: "confirmed",
  refreshStatus: "ok",
  isSample: true,
} satisfies typeof sources.$inferInsert;

/** Undoes every demo-account decision older than `DEMO_REVERT_MINUTES`; returns how many were undone. */
export async function revertExpiredDemoDecisions(store: ReportsStore, now: Date = new Date()): Promise<number> {
  const before = new Date(now.getTime() - DEMO_REVERT_MINUTES * 60_000);
  return store.revertDemoDecisions({ moderator: DEMO_MODERATOR_NAME, before });
}

const CHECK_EVERY_MS = 60_000;
let lastCheck = Number.NEGATIVE_INFINITY;

/**
 * `revertExpiredDemoDecisions` at most once a minute per server instance. Serverless hosting has no timer, so the
 * moderation and places handlers call this on each request; a failure is logged, never fails the request.
 */
export async function revertDemoDecisionsIfDue(store: ReportsStore, now: Date = new Date()): Promise<void> {
  if (now.getTime() - lastCheck < CHECK_EVERY_MS) return;
  lastCheck = now.getTime();
  try {
    await revertExpiredDemoDecisions(store, now);
  } catch (error) {
    lastCheck = Number.NEGATIVE_INFINITY;
    console.error("Reverting demo-account decisions failed", error);
  }
}
