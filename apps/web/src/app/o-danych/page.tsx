import type { Metadata } from "next";
import { Info } from "@phosphor-icons/react/ssr";
import { RELIABILITIES } from "@krakow-bez-barier/ui";
import { ReliabilityBadge } from "@/components/kbb";
import { InfoPage, InfoSection } from "@/components/layout/info-page";
import { pl } from "@/i18n/pl";
import { SourcesList } from "./sources-list";

const t = pl.pages.aboutData;

export const metadata: Metadata = { title: `${t.title} · ${pl.common.app.name}` };

export default function AboutDataPage() {
  return (
    <InfoPage title={t.title}>
      <p className="text-body text-foreground/85">{t.lead}</p>
      <InfoSection title={t.sources}>
        <SourcesList />
      </InfoSection>
      <InfoSection title={t.rulesTitle}>
        <ul className="divide-y divide-border rounded-[20px] bg-surface-raised ring-1 ring-border/70">
          {RELIABILITIES.map((reliability) => (
            <li key={reliability} className="flex flex-col items-start gap-1 px-4 py-3">
              <ReliabilityBadge value={reliability} />
              <span className="text-caption text-muted-foreground">{t.rules[reliability]}</span>
            </li>
          ))}
        </ul>
      </InfoSection>
      <p className="mt-6 flex items-center gap-2 text-caption text-muted-foreground">
        <Info weight="bold" className="size-4 shrink-0" aria-hidden />
        {t.osmAttribution}
      </p>
    </InfoPage>
  );
}
