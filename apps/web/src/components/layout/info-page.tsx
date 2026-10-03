import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

type InfoPageProps = {
  title: string;
  backLabel: string;
  aside?: ReactNode;
  /** Long documents with a side table of contents get a wider column on desktop. */
  wide?: boolean;
  children: ReactNode;
};

/** Secondary page from the menu: back link, one h1, then the content. Owns the skip-link target. */
export function InfoPage({ title, backLabel, aside, wide, children }: InfoPageProps) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className={cn(
        "mx-auto w-full max-w-xl flex-1 px-4 pt-3 pb-10 outline-none print:max-w-none print:pb-0",
        wide && "lg:max-w-5xl",
      )}
    >
      <div className="flex items-center gap-2">
        <Link
          href={routes.home}
          aria-label={backLabel}
          className="press grid size-12 shrink-0 place-items-center rounded-full hover:bg-muted print:hidden"
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
export function InfoSection({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-6 scroll-mt-20">
      <h2 className="mb-2 text-caption font-semibold tracking-[0.06em] text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  );
}
