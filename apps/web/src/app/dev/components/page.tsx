import type { Metadata } from "next";
import { getMessages } from "@/i18n/server";
import { ComponentsPreview } from "./components-preview";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.dev.title} · ${m.common.app.name}`, robots: { index: false, follow: false } };
}

export default async function DevComponentsPage() {
  const t = (await getMessages()).dev;
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-h1 font-extrabold">{t.title}</h1>
        <p className="text-body text-muted-foreground">{t.lead}</p>
      </header>
      <ComponentsPreview />
    </main>
  );
}
