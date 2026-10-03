import type { Metadata } from "next";
import { ShieldCheck } from "@phosphor-icons/react/ssr";
import { InfoPage } from "@/components/layout/info-page";
import { pl } from "@/i18n/pl";

const t = pl.pages.privacy;

export const metadata: Metadata = { title: `${t.title} · ${pl.common.app.name}` };

export default function PrivacyPage() {
  return (
    <InfoPage title={t.title}>
      <p className="flex gap-3 rounded-[20px] bg-primary-container p-4 text-body font-semibold">
        <ShieldCheck weight="fill" className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
        {t.lead}
      </p>
      <div className="mt-2 space-y-2.5">
        {t.sections.map(([title, body]) => (
          <section key={title} className="rounded-[20px] bg-surface-raised p-4 ring-1 ring-border/70">
            <h2 className="text-body font-semibold">{title}</h2>
            <p className="mt-1 text-body-sm text-foreground/80">{body}</p>
          </section>
        ))}
      </div>
    </InfoPage>
  );
}
