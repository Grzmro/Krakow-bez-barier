import type { Metadata } from "next";
import { getMessages } from "@/i18n/server";
import { readEventDetails } from "@/lib/event-link";
import { EventScreen } from "./event-screen";

export async function generateMetadata({ searchParams }: PageProps<"/wydarzenie/[placeId]">): Promise<Metadata> {
  const { name } = readEventDetails(await searchParams);
  const m = await getMessages();
  return { title: [name, m.event.pageTitle, m.common.app.name].filter(Boolean).join(" · ") };
}

// Shared by an event organizer: no account, everything comes from the place id and the query.
export default async function EventPage({ params, searchParams }: PageProps<"/wydarzenie/[placeId]">) {
  const { placeId } = await params;
  const details = readEventDetails(await searchParams);
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto w-full max-w-xl flex-1 px-4 pt-4 pb-10 outline-none lg:max-w-4xl lg:px-8 lg:pt-6 print:max-w-none print:p-0"
    >
      <EventScreen placeId={placeId} details={details} />
    </main>
  );
}
