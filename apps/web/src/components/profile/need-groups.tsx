import type { ReactNode } from "react";
import type { NeedResult, Verdict } from "@krakow-bez-barier/contracts";
import { StatusBadge } from "@/components/kbb";
import { cn } from "@/lib/utils";
import { useMessages } from "@/i18n/client";

type Group = "barrier" | "met" | "unknown";

const GROUP_OF: Record<NeedResult["state"], Group> = { barrier: "barrier", met: "met", unknown: "unknown", conflict: "unknown" };
const ORDER: Group[] = ["barrier", "met", "unknown"];

/**
 * The place card's "Blokuje / Pasuje / Nie wiadomo" groups for the active profile (US-2.5). `basis` renders, under a
 * need, the fact it rests on (the card links it to that fact's row).
 */
export function NeedGroups({
  verdict,
  headingLevel = 3,
  className,
  basis,
}: {
  verdict: Verdict;
  headingLevel?: 2 | 3 | 4;
  className?: string;
  basis?: (need: NeedResult) => ReactNode;
}) {
  const t = useMessages().profile;
  const Heading = `h${headingLevel}` as const;
  const needs = verdict.needs ?? [];
  return (
    <div className={cn("space-y-3", className)}>
      {ORDER.map((group) => {
        const items = needs.filter((n) => GROUP_OF[n.state] === group);
        if (items.length === 0) return null;
        return (
          <section key={group}>
            <Heading className="text-caption font-semibold tracking-[0.04em] text-muted-foreground uppercase">
              {t.groups[group]} ({items.length})
            </Heading>
            <ul className="mt-1.5 space-y-1.5">
              {items.map((need) => (
                <li key={need.need}>
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="text-body-sm font-semibold">{t.needName[need.need]}</span>
                    <StatusBadge status={need.state} reason={need.state === "barrier" ? (need.reason ?? undefined) : undefined} unconfirmed={need.unconfirmed} size="sm" />
                  </div>
                  {basis?.(need)}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
