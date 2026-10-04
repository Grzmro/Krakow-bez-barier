import type { Metadata } from "next";
import Link from "next/link";
import { getMessages } from "@/i18n/server";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.pages.notFound.title} · ${m.common.app.name}` };
}

export default async function NotFound() {
  const m = await getMessages();
  const t = m.pages.notFound;
  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-xl flex-1 px-4 pt-10 pb-10 outline-none">
      <h1 className="font-display text-h2 font-bold">{t.title}</h1>
      <p className="mt-3 text-body text-foreground/85">{t.body}</p>
      <Link
        href={routes.home}
        className="press mt-6 inline-flex h-12 items-center rounded-full bg-primary px-6 text-body font-semibold text-primary-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {t.home}
      </Link>
    </main>
  );
}
