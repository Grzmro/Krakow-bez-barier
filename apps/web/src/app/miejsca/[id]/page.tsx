import type { Metadata } from "next";
import { getMessages } from "@/i18n/server";
import { PlaceScreen } from "./place-screen";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.place.pageTitle} · ${m.common.app.name}` };
}

// A shareable, account-free link: everything the card needs comes from the API by id.
export default async function PlacePage({ params }: PageProps<"/miejsca/[id]">) {
  const { id } = await params;
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-3 pb-10 lg:max-w-6xl lg:px-8 lg:pt-6">
      <PlaceScreen id={id} />
    </main>
  );
}
