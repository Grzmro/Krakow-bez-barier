import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/info-page";
import { getMessages } from "@/i18n/server";
import { PlanScreen } from "./plan-screen";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.plan.pageTitle} · ${m.common.app.name}` };
}

// The plan itself is in the browser (localStorage); the screen loads the places' cards and one route per leg.
export default async function PlanPage() {
  const m = await getMessages();
  return (
    <InfoPage title={m.plan.pageTitle} backLabel={m.pages.back}>
      <PlanScreen />
    </InfoPage>
  );
}
