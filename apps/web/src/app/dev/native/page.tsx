import type { Metadata } from "next";
import { getMessages } from "@/i18n/server";
import { NativePreview } from "./native-preview";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.nearby.devPage.title} · ${m.common.app.name}`, robots: { index: false, follow: false } };
}

export default async function DevNativePage() {
  const t = (await getMessages()).nearby.devPage;
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-h1 font-extrabold">{t.title}</h1>
        <p className="text-body text-muted-foreground">{t.lead}</p>
      </header>
      <NativePreview />
    </main>
  );
}
