import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/info-page";
import { getMessages } from "@/i18n/server";
import { SavedRoutesScreen } from "./saved-routes-screen";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.route.saved.title} · ${m.common.app.name}` };
}

// Precached by public/sw.js: the routes themselves come from IndexedDB, so the page works without a connection.
export default async function SavedRoutesPage() {
  const m = await getMessages();
  return (
    <InfoPage title={m.route.saved.title} backLabel={m.pages.back}>
      <SavedRoutesScreen />
    </InfoPage>
  );
}
