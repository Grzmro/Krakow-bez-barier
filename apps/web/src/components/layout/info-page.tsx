import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { routes } from "@/lib/routes";

type InfoPageProps = { title: string; backLabel: string; aside?: ReactNode; children: ReactNode };

/** Secondary page from the menu: back link, one h1, then the content. Owns the skip-link target. */
export function InfoPage({ title, backLabel, aside, children }: InfoPageProps) {
  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-xl flex-1 px-4 pt-3 pb-10 outline-none">
      <div className="flex items-center gap-2">
        <Link
          href={routes.home}
          aria-label={backLabel}
          className="press grid size-12 shrink-0 place-items-center rounded-full hover:bg-muted"
        >
          <ArrowLeft weight="bold" className="size-5" aria-hidden />
        </Link>
        <h1 className="min-w-0 flex-1 font-display text-h2 font-bold">{title}</h1>
        {aside}
      </div>
      <div className="mt-2">{children}</div>
    </main>
  );
}

/** Titled section with the small uppercase heading used on info pages. */
export function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-caption font-semibold tracking-[0.06em] text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  );
}
