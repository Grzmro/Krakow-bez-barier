import type { Metadata } from "next";
import { pl } from "@/i18n/pl";
import { WidgetCard } from "./widget-card";

export const metadata: Metadata = {
  title: `${pl.business.widget.pageTitle} · ${pl.common.app.name}`,
};

// Embedded in an iframe on venue websites: no app header, no account, one compact card.
export default async function WidgetPage({ params }: PageProps<"/widget/[placeId]">) {
  const { placeId } = await params;
  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-md flex-1 p-3 outline-none">
      <WidgetCard placeId={placeId} />
    </main>
  );
}
