import type { Metadata } from "next";
import { SampleTag } from "@/components/kbb";
import { InfoPage } from "@/components/layout/info-page";
import { getMessages } from "@/i18n/server";
import { isMockApi } from "@/lib/api";
import { CityScreen } from "./city-screen";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.city.title} · ${m.common.app.name}`, robots: { index: false } };
}

export default async function CityPage() {
  const t = await getMessages();
  return (
    <InfoPage title={t.city.title} backLabel={t.pages.back} wide aside={isMockApi ? <SampleTag className="shrink-0" /> : undefined}>
      <CityScreen />
    </InfoPage>
  );
}
