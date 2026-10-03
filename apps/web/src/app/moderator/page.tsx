import type { Metadata } from "next";
import { SampleTag } from "@/components/kbb";
import { InfoPage } from "@/components/layout/info-page";
import { getMessages } from "@/i18n/server";
import { isMockApi } from "@/lib/api";
import { DEMO_REVERT_MINUTES } from "@/server/reports/demo";
import { isDemoAccountEnabled } from "@/server/reports/moderator-auth";
import { ModeratorScreen } from "./moderator-screen";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.moderator.title} · ${m.common.app.name}`, robots: { index: false } };
}

export default async function ModeratorPage() {
  const t = await getMessages();
  // The example-data mode stands in for the demo account (see mock-moderation), so it offers the button too.
  const demoRevertMinutes = isMockApi || isDemoAccountEnabled() ? DEMO_REVERT_MINUTES : null;
  return (
    <InfoPage title={t.moderator.title} backLabel={t.pages.back} aside={isMockApi ? <SampleTag className="shrink-0" /> : undefined}>
      <ModeratorScreen demoRevertMinutes={demoRevertMinutes} />
    </InfoPage>
  );
}
