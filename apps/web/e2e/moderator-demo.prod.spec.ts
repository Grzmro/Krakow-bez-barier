import type { PlaceList, Report } from "@krakow-bez-barier/contracts";
import { expect, test } from "./fixtures";

// The jury's path with the demo account: a report → the moderator panel → approval → the change on the card.
// It writes to the database, so like place-pending-reports it runs only against a throwaway one: E2E_DB_WRITES=1,
// E2E_PROD=1, DATABASE_URL pointing at a freshly seeded database and MODERATOR_DEMO_TOKEN set for the server. That
// the demo account's decisions are undone later is covered by the store tests (drizzle-store.test.ts).

const DEMO_TOKEN = process.env.MODERATOR_DEMO_TOKEN?.trim();
const PLACE = "Kuchnia u Doroty";
const DEMO_SOURCE = "Konto demonstracyjne moderatora (zmiana tymczasowa)";

test("the jury signs in with the demo account, approves a report and sees the change on the card", async ({
  page,
  request,
  expectAccessible,
  evidence,
}) => {
  test.skip(process.env.E2E_DB_WRITES !== "1", "writes to the database — set E2E_DB_WRITES=1 with a throwaway DATABASE_URL");
  test.skip(!process.env.DATABASE_URL || !DEMO_TOKEN, "needs DATABASE_URL and MODERATOR_DEMO_TOKEN");
  test.setTimeout(45_000);

  // GIVEN a seeded place whose OpenStreetMap data says the toilet is accessible, and a report saying it isn't
  const list = (await (await request.get(`/api/v1/places?q=${encodeURIComponent(PLACE)}`)).json()) as PlaceList;
  const place = list.items.find((item) => item.name === PLACE);
  test.skip(!place, `the database has no seeded "${PLACE}"`);
  const sent = await request.post("/api/v1/reports", {
    data: { placeId: place!.id, attribute: "toilet_accessible", value: { kind: "boolean", boolean: false }, comment: "Demo jury" },
  });
  expect(sent.status(), await sent.text()).toBe(201);
  const report = (await sent.json()) as Report;

  // WHEN the jury pastes the demo token into the moderator panel
  await page.goto("/moderator");
  await page.getByLabel("Token moderatora").fill(DEMO_TOKEN!);
  await page.getByRole("button", { name: "Zaloguj" }).click();

  // THEN the panel says it is the demo account and when its decisions are undone
  const notice = page.getByRole("complementary", { name: "Konto demonstracyjne" });
  await expect(notice).toContainText("Po 30 min każdą decyzję tego konta cofamy automatycznie");
  await expect(notice).toMatchAriaSnapshot({ name: "moderator-demo-notice.aria.yml" });

  // WHEN the jury opens that report (the newest one for the place) and approves it
  const entries = page.getByRole("button", { name: new RegExp(`^${PLACE}.*Toaleta dostosowana`) });
  await entries.last().click();
  await expect(page.getByRole("heading", { name: `${PLACE} · Toaleta dostosowana` })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("„Demo jury”");
  await expectAccessible();
  await evidence("moderator-demo-real");
  await page.getByRole("button", { name: "Zatwierdź" }).click();

  // THEN the decision is announced as a demo change and the history links to the card
  await expect(page.getByRole("status").filter({ hasText: /^Zatwierdzone na koncie demonstracyjnym/ })).toBeAttached();
  const history = page.locator("section").filter({ has: page.getByRole("heading", { name: "Historia zmian" }) });
  const entry = history.getByRole("listitem").filter({ hasText: `${PLACE} · Toaleta dostosowana` }).first();
  await expect(entry).toContainText("Konto demonstracyjne ·");
  const decided = await (
    await request.get("/api/v1/moderation/reports?status=accepted&limit=100", {
      headers: { authorization: `Bearer ${DEMO_TOKEN}` },
    })
  ).json();
  expect(decided.items.map((r: Report) => r.id)).toContain(report.id);

  // WHEN the jury follows the link to the card
  await entry.getByRole("link", { name: `Zobacz na karcie: ${PLACE}` }).click();
  await expect(page.getByRole("heading", { level: 1, name: PLACE })).toBeVisible();

  // THEN the toilet row shows the demo account's value beside OpenStreetMap's, with its temporary source named
  const row = page.locator("li").filter({ has: page.getByRole("button", { name: /^Toaleta dostosowana:/ }) });
  await row.getByRole("button", { name: /^Toaleta dostosowana:/ }).click();
  await expect(row).toContainText(DEMO_SOURCE);
  await expect(row).toContainText("OpenStreetMap");
  await expectAccessible();
  await evidence("place-demo-change");
});
