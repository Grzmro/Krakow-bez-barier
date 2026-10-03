"use client";

import { useId } from "react";
import Link from "next/link";
import type { Place } from "@krakow-bez-barier/contracts";
import { buttonVariants, cn } from "@krakow-bez-barier/ui";
import { FactRow } from "@/components/kbb";
import { useLocale, useMessages } from "@/i18n/client";
import { factViews } from "@/lib/place-facts";
import { routes } from "@/lib/routes";

// Entrance facts from a place card: what the route starts or ends at.
const ENTRANCE = new Set(["step_count", "threshold_cm", "door_width_cm", "ramp"]);

/** The entrance facts of a route's start or destination, each with its sources, and a link to the full card. */
export function PlaceEntrance({
  place,
  title,
  level = 2,
  className,
}: {
  place: Place;
  title: string;
  level?: 2 | 3;
  className?: string;
}) {
  const t = useMessages().route;
  const headingId = useId();
  const facts = factViews(place, useLocale()).filter((f) => ENTRANCE.has(f.attribute));
  const Heading = level === 3 ? "h3" : "h2";
  return (
    <section aria-labelledby={headingId} className={cn("mt-6", className)}>
      <Heading id={headingId} className="text-title font-semibold">
        {title} · {place.name}
      </Heading>
      <p className="mt-0.5 mb-2 text-caption text-muted-foreground">{t.destination.hint}</p>
      <ul className="divide-y divide-border overflow-hidden rounded-[20px] bg-surface-raised shadow-soft ring-1 ring-border">
        {facts.map((fact) => (
          <FactRow
            key={fact.attribute}
            label={fact.label}
            value={fact.value}
            unit={fact.unit}
            reliability={fact.reliability}
            sources={fact.sources}
          />
        ))}
      </ul>
      <Link href={routes.place(place.id)} className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-10 px-0")}>
        {t.destination.open}
      </Link>
    </section>
  );
}
