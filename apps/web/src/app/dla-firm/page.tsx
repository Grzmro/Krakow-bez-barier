import type { Metadata } from "next";
import { SampleTag } from "@/components/kbb";
import { InfoPage } from "@/components/layout/info-page";
import { getMessages } from "@/i18n/server";
import { isMockApi } from "@/lib/api";
import { BusinessScreen } from "./business-screen";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.business.page.title} · ${m.common.app.name}` };
}

// The widget preview shows the place in `?miejsce=<id>`, e.g. the hotel a sales demo is about.
export default async function BusinessPage({ searchParams }: PageProps<"/dla-firm">) {
  const m = await getMessages();
  const { miejsce } = await searchParams;
  return (
    <InfoPage
      title={m.business.page.title}
      backLabel={m.pages.back}
      aside={isMockApi ? <SampleTag className="shrink-0" /> : undefined}
      width="full"
    >
      <BusinessScreen placeId={typeof miejsce === "string" && miejsce ? miejsce : undefined} />
    </InfoPage>
  );
}
