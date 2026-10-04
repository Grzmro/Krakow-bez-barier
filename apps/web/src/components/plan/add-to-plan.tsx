"use client";

import Link from "next/link";
import { Check, ListPlus } from "@phosphor-icons/react";
import { Button, buttonVariants, useAnnounce } from "@krakow-bez-barier/ui";
import { useMessages } from "@/i18n/client";
import { isInPlan, MAX_STOPS } from "@/lib/day-plan";
import { routes } from "@/lib/routes";
import { usePlan } from "@/lib/use-plan";

/** "Add to plan" on a place card; once the place is in the plan it turns into a link to the plan. */
export function AddToPlan({ place }: { place: { id: string; name: string } }) {
  const t = useMessages().plan;
  const announce = useAnnounce();
  const { plan, add } = usePlan();
  const inPlan = isInPlan(plan, place.id);
  const full = !inPlan && plan.length >= MAX_STOPS;

  if (inPlan) {
    return (
      <Link href={routes.plan} className={buttonVariants({ variant: "outline", size: "sm" })}>
        <Check weight="bold" />
        {t.addedShort}: {t.openPlan}
      </Link>
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      aria-disabled={full}
      onClick={() => announce(full ? t.full(MAX_STOPS) : (add({ id: place.id, name: place.name }), t.added(place.name)))}
    >
      <ListPlus weight="bold" />
      {t.add}
    </Button>
  );
}
