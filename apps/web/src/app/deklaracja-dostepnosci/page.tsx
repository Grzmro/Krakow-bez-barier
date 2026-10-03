import type { Metadata } from "next";
import type { Icon } from "@phosphor-icons/react";
import { CaretRight, CheckCircle, Question } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { InfoPage, InfoSection } from "@/components/layout/info-page";
import { pl } from "@/i18n/pl";

const t = pl.pages.a11y;

export const metadata: Metadata = { title: `${t.title} · ${pl.common.app.name}` };

function Bullets({ items, icon: I, tone }: { items: readonly string[]; icon: Icon; tone: string }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-body-sm">
          <I weight="fill" className={cn("mt-0.5 size-[18px] shrink-0", tone)} aria-hidden />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function AccessibilityStatementPage() {
  return (
    <InfoPage title={t.title}>
      <p className="text-body text-foreground/85">{t.lead}</p>
      <InfoSection title={t.works}>
        <Bullets items={t.worksList} icon={CheckCircle} tone="text-status-met" />
      </InfoSection>
      <InfoSection title={t.limits}>
        <Bullets items={t.limitsList} icon={Question} tone="text-status-conflict" />
      </InfoSection>
      <InfoSection title={t.plan}>
        <Bullets items={t.planList} icon={CaretRight} tone="text-primary" />
      </InfoSection>
      <p className="mt-6 text-caption text-muted-foreground">{t.contact}</p>
    </InfoPage>
  );
}
