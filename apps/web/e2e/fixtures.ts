import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page, type TestInfo } from "@playwright/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

type Fixtures = {
  /** Runs axe-core against the current page with WCAG 2.2 A/AA rules and fails on any violation. */
  expectAccessible: (options?: { exclude?: string[] }) => Promise<void>;
  /** Saves a screenshot to test-results/evidence/<name>.png — attached to the PR/Linear task as proof. */
  evidence: (name: string) => Promise<void>;
};

export const test = base.extend<Fixtures>({
  expectAccessible: async ({ page }, use) => {
    await use(async (options) => {
      // axe reads colours as they are; mid-transition (e.g. a segment just checked) they fail contrast.
      await settleMotion(page);
      let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
      for (const selector of options?.exclude ?? []) builder = builder.exclude(selector);
      const { violations } = await builder.analyze();
      const summary = violations.map(
        (v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
      );
      expect(summary, "axe WCAG 2.2 AA violations").toEqual([]);
    });
  },
  evidence: async ({ page }, use, testInfo) => {
    await use((name) => saveEvidence(page, testInfo, name));
  },
});

const EVIDENCE_DIR = path.join(__dirname, "..", "test-results", "evidence");

/** Waits for running CSS transitions and finite CSS animations (a row fading in) to end; loops like a spinner don't. */
export async function settleMotion(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(
          (a) =>
            a instanceof CSSTransition ||
            (a instanceof CSSAnimation && a.effect?.getComputedTiming().iterations !== Infinity),
        )
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

async function saveEvidence(page: Page, testInfo: TestInfo, name: string) {
  await settleMotion(page);
  const file = path.join(EVIDENCE_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}

export { expect };
