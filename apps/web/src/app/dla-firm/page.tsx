import type { Metadata } from "next";
import { SampleTag } from "@/components/kbb";
import { InfoPage } from "@/components/layout/info-page";
import { pl } from "@/i18n/pl";
import { BusinessScreen } from "./business-screen";

export const metadata: Metadata = {
  title: `${pl.business.page.title} · ${pl.common.app.name}`,
};

export default function BusinessPage() {
  return (
    <InfoPage title={pl.business.page.title} aside={<SampleTag className="shrink-0" />}>
      <BusinessScreen />
    </InfoPage>
  );
}
