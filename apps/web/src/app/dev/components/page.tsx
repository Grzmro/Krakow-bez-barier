import type { Metadata } from "next";
import { pl } from "@/i18n/pl";
import { ComponentsPreview } from "./components-preview";

export const metadata: Metadata = {
  title: `${pl.dev.title} · ${pl.common.app.name}`,
  robots: { index: false, follow: false },
};

export default function DevComponentsPage() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-h1 font-extrabold">{pl.dev.title}</h1>
        <p className="text-body text-muted-foreground">{pl.dev.lead}</p>
      </header>
      <ComponentsPreview />
    </main>
  );
}
