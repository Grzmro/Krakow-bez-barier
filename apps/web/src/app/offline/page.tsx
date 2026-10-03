import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";
import { getMessages } from "@/i18n/server";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.pwa.offlinePage.title} — ${m.common.app.name}` };
}

// Served by the service worker (public/sw.js) for navigations it has no cached copy of.
export default async function OfflinePage() {
  const t = (await getMessages()).pwa.offlinePage;
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
