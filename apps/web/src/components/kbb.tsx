"use client";

// Shared components from @krakow-bez-barier/ui with their copy bound from the `common` messages area.
// Screens import from here so status words, reliability labels and PRZYKŁAD stay consistent.
import {
  BottomPanel as UiBottomPanel,
  FactRow as UiFactRow,
  ReliabilityBadge as UiReliabilityBadge,
  SampleTag as UiSampleTag,
  StatusBadge as UiStatusBadge,
  VerdictBlock as UiVerdictBlock,
  type BottomPanelProps,
  type FactRowProps,
  type Reliability,
  type Status,
  type StatusBadgeProps,
  type VerdictBlockProps,
} from "@krakow-bez-barier/ui";
import type { VehicleAccessibility } from "@krakow-bez-barier/contracts";
import { useLocale, useMessages } from "@/i18n/client";
import { licenseLang, sourceTextLang } from "@/lib/source-text";
import { VEHICLE_STATUS } from "@/lib/transit";

type Unconfirmed = { unconfirmed?: boolean };

/**
 * Text a source provided — its name, licence, attribution — shown untranslated, with its language marked where it
 * differs from the page (WCAG 3.1.2). `license` set: our own translated licence wording is not marked.
 */
export function SourceText({ children, license }: { children: string; license?: boolean }) {
  const locale = useLocale();
  const lang = license ? licenseLang(children, locale) : sourceTextLang(children, locale);
  return lang ? <span lang={lang}>{children}</span> : <>{children}</>;
}

export function StatusBadge({ unconfirmed, ...props }: Omit<StatusBadgeProps, "label" | "note"> & Unconfirmed) {
  const t = useMessages().common;
  return <UiStatusBadge {...props} label={t.status[props.status]} note={unconfirmed ? t.unconfirmed : undefined} />;
}

export function VerdictBlock({ unconfirmed, ...props }: Omit<VerdictBlockProps, "label" | "note"> & Unconfirmed) {
  const t = useMessages().common;
  return <UiVerdictBlock {...props} label={t.status[props.status]} note={unconfirmed ? t.unconfirmed : undefined} />;
}

/** `label` replaces the reliability word, e.g. "Może być nieaktualne · 15.09.2025". */
export function ReliabilityBadge({ value, label, className }: { value: Reliability; label?: string; className?: string }) {
  const t = useMessages().common;
  return <UiReliabilityBadge value={value} label={label ?? t.reliability[value]} className={className} />;
}

export function SampleTag({ className }: { className?: string }) {
  const t = useMessages().common;
  return <UiSampleTag label={t.sample.tag} ariaLabel={t.sample.aria} className={className} />;
}

/** Marks a source outage switched on for a demonstration (`Source.simulatedOutage`), like `SampleTag` marks sample data. */
export function DemoOutageTag({ className }: { className?: string }) {
  const t = useMessages().common;
  return <UiSampleTag label={t.demoOutage.tag} ariaLabel={t.demoOutage.aria} className={className} />;
}

type FactRowBoundProps = Omit<FactRowProps, "labels" | "status" | "reliability"> & {
  status?: Status;
  reliability: Reliability;
};

export function FactRow({ status, reliability, ...props }: FactRowBoundProps) {
  const t = useMessages().common;
  const known = props.value !== undefined && props.value !== "";
  const value = known ? [props.value, props.unit].filter(Boolean).join(" ") : t.fact.noValue;
  const shown = props.limit ? `${value} (${props.limit})` : value;
  return (
    <UiFactRow
      {...props}
      ariaLabel={
        props.ariaLabel ??
        t.fact.aria(props.label, shown, t.reliability[reliability], status ? t.status[status] : undefined)
      }
      status={status ? { value: status, label: t.status[status] } : undefined}
      reliability={{ value: reliability, label: t.reliability[reliability] }}
      labels={t.fact}
    />
  );
}

/** One list row naming every attribute without data ("Brak danych: Przewijak, Parking"), after the known ones. */
export function UnknownFactsItem({ labels, className }: { labels: readonly string[]; className?: string }) {
  const t = useMessages().common.fact;
  if (!labels.length) return null;
  return (
    <li className={className}>
      <p className="text-body-sm">
        <span className="font-semibold text-muted-foreground">{t.unknownGroup}</span> {labels.join(", ")}
      </p>
      <p className="mt-0.5 text-caption text-muted-foreground">{t.unknownGroupHint}</p>
    </li>
  );
}

export function BottomPanel(props: Omit<BottomPanelProps, "toggleLabels">) {
  const t = useMessages().common;
  return <UiBottomPanel {...props} toggleLabels={t.bottomPanel} />;
}

/** Whether the vehicle on a departure takes a wheelchair; only the operator's word for the vehicle is coloured. */
export function VehicleBadge({ state, className }: { state: VehicleAccessibility["state"]; className?: string }) {
  const t = useMessages().transit;
  return <UiStatusBadge status={VEHICLE_STATUS[state]} label={t.vehicle[state]} size="sm" className={className} />;
}
