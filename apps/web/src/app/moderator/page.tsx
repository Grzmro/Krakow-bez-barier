import type { Metadata } from "next";
import { SampleTag } from "@/components/kbb";
import { InfoPage } from "@/components/layout/info-page";
import { getMessages } from "@/i18n/server";
import { isMockApi } from "@/lib/api";
import { ModeratorScreen } from "./moderator-screen";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.moderator.title} · ${m.common.app.name}`, robots: { index: false } };
}

export default async function ModeratorPage() {
  const t = await getMessages();
  return (
    <InfoPage title={t.moderator.title} backLabel={t.pages.back} aside={isMockApi ? <SampleTag className="shrink-0" /> : undefined}>
      <ModeratorScreen />
    </InfoPage>
  );
}
