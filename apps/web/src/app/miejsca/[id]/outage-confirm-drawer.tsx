"use client";

import { outageRules, type OutageEquipment } from "@krakow-bez-barier/contracts";
import {
  Button,
  VaulDrawer,
  VaulDrawerClose,
  VaulDrawerContent,
  VaulDrawerDescription,
  VaulDrawerTitle,
} from "@krakow-bez-barier/ui";
import { Info } from "@phosphor-icons/react";
import { useMessages } from "@/i18n/client";

export interface OutageConfirmDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeName: string;
  equipment: OutageEquipment;
  /** The facts don't say whether the place has this equipment at all ("Brak danych"). */
  unknown: boolean;
  onConfirm: (equipment: OutageEquipment) => void;
}

/** One deliberate step between "Zgłoś awarię" and a saved outage, so a stray tap doesn't mark a barrier. */
export function OutageConfirmDrawer({ open, onOpenChange, placeName, equipment, unknown, onConfirm }: OutageConfirmDrawerProps) {
  const b = useMessages().place.breakdown;
  return (
    <VaulDrawer open={open} onOpenChange={onOpenChange}>
      <VaulDrawerContent aria-describedby="outage-confirm-body">
        <div className="overflow-y-auto px-4 pt-4 pb-5">
          <p className="text-body-sm text-muted-foreground">{placeName}</p>
          <VaulDrawerTitle className="mt-1 font-display text-h2 font-bold">{b.confirmTitle(equipment)}</VaulDrawerTitle>
          <VaulDrawerDescription id="outage-confirm-body" className="mt-3 text-body-sm">
            {b.confirmBody(outageRules.expiresAfterHours)}
          </VaulDrawerDescription>
          {unknown ? (
            <p className="mt-3 flex gap-2 rounded-2xl border border-dashed border-status-unknown bg-status-unknown-bg p-3 text-body-sm">
              <Info weight="fill" className="mt-0.5 size-[18px] shrink-0" aria-hidden />
              <span>{b.confirmUnknown(equipment)}</span>
            </p>
          ) : null}
          <Button size="lg" className="mt-5 w-full" onClick={() => onConfirm(equipment)}>
            {b.reportAria(equipment)}
          </Button>
          <VaulDrawerClose asChild>
            <Button variant="outline" size="lg" className="mt-2.5 w-full">
              {b.cancel}
            </Button>
          </VaulDrawerClose>
        </div>
      </VaulDrawerContent>
    </VaulDrawer>
  );
}
