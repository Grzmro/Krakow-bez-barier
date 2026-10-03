// Shared components from @krakow-bez-barier/ui with their Polish copy bound from i18n/pl/common.
// Screens import from here so status words, reliability labels and PRZYKŁAD stay consistent.
import {
  BottomPanel as UiBottomPanel,
  FactRow as UiFactRow,
  ReliabilityBadge as UiReliabilityBadge,
  SampleBanner as UiSampleBanner,
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
import { pl } from "@/i18n/pl";

const t = pl.common;

type Unconfirmed = { unconfirmed?: boolean };

export function StatusBadge({ unconfirmed, ...props }: Omit<StatusBadgeProps, "label" | "note"> & Unconfirmed) {
  return <UiStatusBadge {...props} label={t.status[props.status]} note={unconfirmed ? t.unconfirmed : undefined} />;
}

export function VerdictBlock({ unconfirmed, ...props }: Omit<VerdictBlockProps, "label" | "note"> & Unconfirmed) {
  return <UiVerdictBlock {...props} label={t.status[props.status]} note={unconfirmed ? t.unconfirmed : undefined} />;
}

export function ReliabilityBadge({ value, className }: { value: Reliability; className?: string }) {
  return <UiReliabilityBadge value={value} label={t.reliability[value]} className={className} />;
}

export function SampleTag({ className }: { className?: string }) {
  return <UiSampleTag label={t.sample.tag} ariaLabel={t.sample.aria} className={className} />;
}

export function SampleBanner({ className }: { className?: string }) {
  return <UiSampleBanner text={t.layout.sampleBanner} className={className} />;
}

type FactRowBoundProps = Omit<FactRowProps, "labels" | "status" | "reliability"> & {
  status?: Status;
  reliability: Reliability;
};

export function FactRow({ status, reliability, ...props }: FactRowBoundProps) {
  return (
    <UiFactRow
      {...props}
      status={status ? { value: status, label: t.status[status] } : undefined}
      reliability={{ value: reliability, label: t.reliability[reliability] }}
      labels={t.fact}
    />
  );
}

export function BottomPanel(props: Omit<BottomPanelProps, "toggleLabels">) {
  return <UiBottomPanel {...props} toggleLabels={t.bottomPanel} />;
}
