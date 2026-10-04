import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMessages } from "@/i18n/server";
import { placeName } from "@/server/places/place-name";
import { PlaceScreen } from "./place-screen";

export async function generateMetadata({ params }: PageProps<"/miejsca/[id]">): Promise<Metadata> {
  const { id } = await params;
  const [m, name] = await Promise.all([getMessages(), placeName(id)]);
  if (name === null) notFound();
  return { title: `${name ?? m.place.pageTitle} · ${m.common.app.name}` };
}

// A shareable, account-free link: everything the card needs comes from the API by id.
export default async function PlacePage({ params }: PageProps<"/miejsca/[id]">) {
  const { id } = await params;
  if ((await placeName(id)) === null) notFound();
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-3 pb-10 lg:max-w-6xl lg:px-8 lg:pt-6">
      <PlaceScreen id={id} />
    </main>
  );
}
