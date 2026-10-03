import type { NeedResult, Verdict } from "@krakow-bez-barier/contracts";
import { StatusBadge } from "@/components/kbb";
import { cn } from "@/lib/utils";
import { pl } from "@/i18n/pl";

const t = pl.profile;

type Group = "barrier" | "met" | "unknown";

const GROUP_OF: Record<NeedResult["state"], Group> = { barrier: "barrier", met: "met", unknown: "unknown", conflict: "unknown" };
const ORDER: Group[] = ["barrier", "met", "unknown"];

/** The place card's "Blokuje / Pasuje / Nie wiadomo" groups for the active profile (US-2.5). */
export function NeedGroups({ verdict, headingLevel = 3, className }: { verdict: Verdict; headingLevel?: 2 | 3 | 4; className?: string }) {
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
                <li key={need.need} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="text-body-sm font-semibold">{t.needName[need.need]}</span>
                  <StatusBadge status={need.state} reason={need.state === "barrier" ? (need.reason ?? undefined) : undefined} unconfirmed={need.unconfirmed} size="sm" />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
