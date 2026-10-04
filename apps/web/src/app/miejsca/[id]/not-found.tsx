import type { Metadata } from "next";
import { getMessages } from "@/i18n/server";
import { PlaceNotFound } from "./place-not-found";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.place.notFound} · ${m.common.app.name}` };
}

export default async function PlaceNotFoundPage() {
  const m = await getMessages();
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-3 pb-10 lg:max-w-6xl lg:px-8 lg:pt-6">
      <PlaceNotFound t={m.place} />
    </main>
  );
}
