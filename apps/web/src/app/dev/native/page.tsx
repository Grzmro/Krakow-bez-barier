import type { Metadata } from "next";
import { pl } from "@/i18n/pl";
import { NativePreview } from "./native-preview";

const t = pl.nearby.devPage;

export const metadata: Metadata = {
  title: `${t.title} · ${pl.common.app.name}`,
  robots: { index: false, follow: false },
};

export default function DevNativePage() {
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
