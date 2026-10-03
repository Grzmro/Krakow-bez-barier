import type { Metadata } from "next";
import { pl } from "@/i18n/pl";
import { PlaceScreen } from "./place-screen";

export const metadata: Metadata = {
  title: `${pl.place.pageTitle} · ${pl.common.app.name}`,
};

// A shareable, account-free link: everything the card needs comes from the API by id.
export default async function PlacePage({ params }: PageProps<"/miejsca/[id]">) {
  const { id } = await params;
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-3 pb-10">
      <PlaceScreen id={id} />
    </main>
  );
}
