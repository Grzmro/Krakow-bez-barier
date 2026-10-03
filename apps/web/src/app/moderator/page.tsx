import type { Metadata } from "next";
import { SampleTag } from "@/components/kbb";
import { InfoPage } from "@/components/layout/info-page";
import { pl } from "@/i18n/pl";
import { isMockApi } from "@/lib/api";
import { ModeratorScreen } from "./moderator-screen";

export const metadata: Metadata = {
  title: `${pl.moderator.title} · ${pl.common.app.name}`,
  robots: { index: false },
};

export default function ModeratorPage() {
  return (
    <InfoPage title={pl.moderator.title} aside={isMockApi ? <SampleTag className="shrink-0" /> : undefined}>
      <ModeratorScreen />
    </InfoPage>
  );
}
