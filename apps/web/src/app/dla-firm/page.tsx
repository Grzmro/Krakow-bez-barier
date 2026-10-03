import type { Metadata } from "next";
import { SampleTag } from "@/components/kbb";
import { InfoPage } from "@/components/layout/info-page";
import { getMessages } from "@/i18n/server";
import { BusinessScreen } from "./business-screen";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.business.page.title} · ${m.common.app.name}` };
}

export default async function BusinessPage() {
  const m = await getMessages();
  return (
    <InfoPage title={m.business.page.title} backLabel={m.pages.back} aside={<SampleTag className="shrink-0" />} width="full">
      <BusinessScreen />
    </InfoPage>
  );
}
