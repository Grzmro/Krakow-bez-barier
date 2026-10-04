import type { ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

/** Secondary detail behind a "Więcej" / "Dlaczego?" toggle, so the main view keeps one short message. */
export function MoreInfo({ summary, children, className }: { summary: string; children: ReactNode; className?: string }) {
  return (
    <details className={cn("group", className)}>
      <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1 text-caption font-semibold text-primary underline underline-offset-2 [&::-webkit-details-marker]:hidden">
        {summary}
        <CaretDown weight="bold" className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="mt-1 space-y-1 text-caption text-muted-foreground">{children}</div>
    </details>
  );
}
