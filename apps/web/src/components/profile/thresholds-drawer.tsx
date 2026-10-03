"use client";

import { useId } from "react";
import { ArrowCounterClockwise, Minus, Plus } from "@phosphor-icons/react";
import {
  Button,
  LabeledSwitch,
  VaulDrawer,
  VaulDrawerContent,
  VaulDrawerDescription,
  VaulDrawerTitle,
} from "@krakow-bez-barier/ui";
import { pl } from "@/i18n/pl";
import { THRESHOLD_LIMITS, type Thresholds } from "@/lib/profile/thresholds";
import { useProfile } from "@/lib/profile/use-profile";
import { ProfileSwitch } from "./profile-switch";

const t = pl.profile.thresholds;

type NumberKey = keyof typeof THRESHOLD_LIMITS;
type FlagKey = Exclude<keyof Thresholds, NumberKey>;

const FLAGS: FlagKey[] = [
  "requireStepFree",
  "requireLift",
  "requireAccessibleToilet",
  "requireSmoothSurface",
  "requireChangingTable",
];

function Stepper({ label, value, limits, onChange }: { label: string; value: number; limits: (typeof THRESHOLD_LIMITS)[NumberKey]; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div className="flex min-h-14 items-center justify-between gap-3">
      <span id={id} className="text-body-sm font-semibold">
        {label}
      </span>
      <div role="group" aria-labelledby={id} className="flex items-center gap-1 rounded-full bg-muted p-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="bg-card"
          aria-label={t.decrease(label)}
          disabled={value <= limits.min}
          onClick={() => onChange(Math.max(limits.min, value - limits.step))}
        >
          <Minus weight="bold" />
        </Button>
        <output aria-live="polite" className="w-16 text-center font-heading text-[17px] font-extrabold tabular-nums">
          {value} {t.cm}
        </output>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="bg-card"
          aria-label={t.increase(label)}
          disabled={value >= limits.max}
          onClick={() => onChange(Math.min(limits.max, value + limits.step))}
        >
          <Plus weight="bold" />
        </Button>
      </div>
    </div>
  );
}

/** Edits the active profile's thresholds; changes apply (and persist) immediately. */
export function ThresholdsDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { settings, setProfile, setThresholds, resetThresholds } = useProfile();
  const profile = settings.profile;
  if (!profile) return null;
  const value = settings.thresholds[profile];
  const set = <K extends keyof Thresholds>(key: K, next: Thresholds[K]) => setThresholds(profile, { ...value, [key]: next });

  return (
    <VaulDrawer open={open} onOpenChange={onOpenChange}>
      <VaulDrawerContent>
        <div className="overflow-y-auto px-4 pt-4 pb-5">
          <VaulDrawerTitle className="font-heading text-h2 font-bold">{t.title}</VaulDrawerTitle>
          <VaulDrawerDescription className="mt-1 text-body-sm text-muted-foreground">{t.proposal}</VaulDrawerDescription>
          <ProfileSwitch value={profile} onChange={(next) => next && setProfile(next)} allowOff={false} className="mt-4" />
          <div className="mt-3 divide-y divide-border">
            <Stepper
              label={t.maxThresholdCm}
              value={value.maxThresholdCm}
              limits={THRESHOLD_LIMITS.maxThresholdCm}
              onChange={(v) => set("maxThresholdCm", v)}
            />
            <Stepper
              label={t.minDoorWidthCm}
              value={value.minDoorWidthCm}
              limits={THRESHOLD_LIMITS.minDoorWidthCm}
              onChange={(v) => set("minDoorWidthCm", v)}
            />
            {FLAGS.map((key) => (
              <LabeledSwitch
                key={key}
                label={t[key]}
                hint={key === "requireStepFree" ? t.requireStepFreeHint : undefined}
                checked={value[key]}
                onCheckedChange={(checked) => set(key, checked)}
              />
            ))}
          </div>
          <p className="mt-2 text-caption text-muted-foreground">{t.browserOnly}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="outline" size="lg" className="px-3" onClick={() => resetThresholds(profile)}>
              <ArrowCounterClockwise weight="bold" />
              {t.reset}
            </Button>
            <Button size="lg" onClick={() => onOpenChange(false)}>
              {t.done}
            </Button>
          </div>
        </div>
      </VaulDrawerContent>
    </VaulDrawer>
  );
}
