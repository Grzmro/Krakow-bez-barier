import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "@phosphor-icons/react/ssr";
import { RELIABILITIES } from "@krakow-bez-barier/ui";
import { ReliabilityBadge } from "@/components/kbb";
import { InfoPage, InfoSection } from "@/components/layout/info-page";
import { getMessages } from "@/i18n/server";
import { routes } from "@/lib/routes";
import { SourcesList } from "./sources-list";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.pages.aboutData.title} · ${m.common.app.name}` };
}

export default async function AboutDataPage() {
  const m = await getMessages();
  const t = m.pages.aboutData;
  return (
    <InfoPage title={t.title} backLabel={m.pages.back} width="full">
      <p className="max-w-3xl text-body text-foreground/85">{t.lead}</p>
      <p className="mt-2">
        <Link href={routes.dataQuality} className="inline-flex min-h-6 items-center font-semibold text-primary underline underline-offset-2">
          {m.quality.aboutLink}
        </Link>
      </p>
      <InfoSection title={t.sources}>
        <SourcesList />
      </InfoSection>
      <InfoSection title={t.rulesTitle}>
        <ul className="divide-y divide-border rounded-[20px] bg-surface-raised ring-1 ring-border/70">
          {RELIABILITIES.map((reliability) => (
            <li key={reliability} className="flex flex-col items-start gap-1 px-4 py-3 lg:flex-row lg:items-center lg:gap-4">
              <span className="lg:w-44 lg:shrink-0">
                <ReliabilityBadge value={reliability} />
              </span>
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
