import type { Metadata } from "next";
import { getMessages } from "@/i18n/server";
import { WidgetCard } from "./widget-card";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.business.widget.pageTitle} · ${m.common.app.name}` };
}

// Embedded in an iframe on venue websites: no app header, no account, one compact card.
export default async function WidgetPage({ params }: PageProps<"/widget/[placeId]">) {
  const { placeId } = await params;
  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-md flex-1 p-3 outline-none">
      <WidgetCard placeId={placeId} />
    </main>
  );
}
