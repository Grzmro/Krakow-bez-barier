import type { Metadata } from "next";
import { ButtonLink } from "@/components/pwa/button-link";
import { pl } from "@/i18n/pl";
import { routes } from "@/lib/routes";

const t = pl.pwa.offlinePage;

export const metadata: Metadata = { title: `${t.title} — ${pl.common.app.name}` };

// Served by the service worker (public/sw.js) for navigations it has no cached copy of.
export default function OfflinePage() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-10">
      <h1 className="font-heading text-display font-extrabold text-foreground">{t.title}</h1>
      <p className="text-body text-muted-foreground">{t.lead}</p>
      <ButtonLink href={routes.home} className="self-start">
        {t.home}
      </ButtonLink>
    </main>
  );
}
