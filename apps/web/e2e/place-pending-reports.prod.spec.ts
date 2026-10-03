import type { Place, PlaceList } from "@krakow-bez-barier/contracts";
import { expect, test } from "./fixtures";

// Writes reports and moderates them, so it runs only against a throwaway database: E2E_DB_WRITES=1 plus E2E_PROD=1,
// DATABASE_URL pointing at a freshly seeded database (`npm run db:setup`) and MODERATOR_TOKENS set (root .env). It
// skips itself otherwise — in CI and against the shared local database.

const MODERATOR = (process.env.MODERATOR_TOKENS ?? "").split(",")[0]?.split(":")[1]?.trim();
const PLACE = "Kazimir";

test("a sent report shows on the card for every visitor until a moderator decides", async ({
  page,
  request,
  expectAccessible,
  evidence,
}) => {
  test.skip(process.env.E2E_DB_WRITES !== "1", "writes to the database — set E2E_DB_WRITES=1 with a throwaway DATABASE_URL");
  test.skip(!process.env.DATABASE_URL || !MODERATOR, "needs DATABASE_URL and MODERATOR_TOKENS");
  test.setTimeout(45_000);

  // GIVEN a seeded place with a toilet row on its card
  const list = (await (await request.get(`/api/v1/places?q=${PLACE}`)).json()) as PlaceList;
  const place = list.items.find((item) => item.name === PLACE);
  test.skip(!place, `the database has no seeded "${PLACE}"`);
  const id = place!.id;
  const toiletRow = () => page.locator("li").filter({ has: page.getByRole("button", { name: /^Toaleta dostosowana:/ }) });
  const pendingIds = async () => {
    const card = (await (await request.get(`/api/v1/places/${id}`)).json()) as Place;
    return card.attributes.find((a) => a.attribute === "toilet_accessible")?.pendingReports?.map((r) => r.id) ?? [];
  };
  const moderate = async (reportId: string, decision: "rejected" | "accepted") => {
    const res = await request.post("/api/v1/moderation/reports", {
      headers: { authorization: `Bearer ${MODERATOR}` },
      data: { reportId, decision },
    });
    expect(res.status(), await res.text()).toBe(200);
  };
  const sendReport = async () => {
    await toiletRow().getByRole("button", { name: /To się nie zgadza|Uzupełnij/ }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("radio", { name: "Jest dostosowana" })).toBeFocused();
    await page.keyboard.press("Space");
    await page.keyboard.press("Enter");
    await expect(drawer).toBeHidden();
    await expect(toiletRow()).toContainText("Twoje zgłoszenie:Jest");
    await expect(toiletRow()).not.toContainText("wysyłanie", { timeout: 10_000 });
  };
  const before = await pendingIds();

  // WHEN a visitor reports that the toilet is accessible and the card is reloaded
  await page.goto(`/miejsca/${id}`);
  await sendReport();
  await expect.poll(pendingIds).toHaveLength(before.length + 1);
  const [first] = (await pendingIds()).filter((r) => !before.includes(r));
  await page.reload();

  // THEN the report is still listed beside the value, as unverified, without changing the value
  const row = toiletRow();
  await row.getByRole("button", { name: /^Toaleta dostosowana:/ }).click();
  await expect(row).toContainText("Zgłoszenie użytkownika:Jest");
  await expect(row).toContainText("Niezweryfikowane");
  await expect(row).toContainText("Czeka na weryfikację — nie zmienia danych powyżej.");
  await expect(row.getByRole("listitem").filter({ hasText: "Zgłoszenie użytkownika" }).first()).toMatchAriaSnapshot({
    name: "place-pending-report.aria.yml",
  });
  await expectAccessible();
  await evidence("place-pending-report");

  // WHEN a moderator rejects it
  await moderate(first, "rejected");
  await page.reload();

  // THEN it disappears from the card
  await expect(page.getByRole("heading", { level: 1, name: PLACE })).toBeVisible();
  await expect(toiletRow()).not.toContainText("Zgłoszenie użytkownika");

  // WHEN another report is sent, the card refetches it, and a moderator accepts it
  const cardRead = () =>
    page.waitForResponse((r) => r.request().method() === "GET" && r.url().includes(`/api/v1/places/${id}`));
  const listed = cardRead();
  await sendReport();
  await listed;
  await expect.poll(pendingIds).toHaveLength(before.length + 1);
  const [second] = (await pendingIds()).filter((r) => !before.includes(r));
  await moderate(second, "accepted");

  // THEN the visitor's own pending entry drops out on the next refetch, without a reload
  const refetched = cardRead();
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  await refetched;
  await expect(toiletRow()).not.toContainText("Twoje zgłoszenie");
  await page.reload();

  // THEN the card shows a fact from "Społeczność, zweryfikowane przez moderatora", not a pending report
  const accepted = toiletRow();
  const fact = accepted.getByRole("button", { name: /^Toaleta dostosowana:/ });
  await fact.click();
  await expect(fact).toHaveAttribute("aria-expanded", "true");
  await expect(accepted).toContainText("Społeczność, zweryfikowane przez moderatora");
  await expect(accepted).not.toContainText("Zgłoszenie użytkownika");
  await expectAccessible();
  await evidence("place-report-accepted");
});
