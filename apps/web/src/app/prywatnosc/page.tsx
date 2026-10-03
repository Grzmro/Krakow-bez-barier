import type { Metadata } from "next";
import { ShieldCheck } from "@phosphor-icons/react/ssr";
import { InfoPage } from "@/components/layout/info-page";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.pages.privacy.title} · ${m.common.app.name}` };
}

export default async function PrivacyPage() {
  const m = await getMessages();
  const t = m.pages.privacy;
  return (
    <InfoPage title={t.title} backLabel={m.pages.back} width="wide">
      <p className="flex gap-3 rounded-[20px] bg-primary-container p-4 text-body font-semibold">
        <ShieldCheck weight="fill" className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
        {t.lead}
      </p>
      <div className="mt-2 grid gap-2.5 lg:grid-cols-2">
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
