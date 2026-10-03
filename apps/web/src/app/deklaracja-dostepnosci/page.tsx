import type { Metadata } from "next";
import { Badge } from "@krakow-bez-barier/ui";
import { CalendarBlank, CaretDown, Clock, Scales, Warning } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { InfoPage, InfoSection } from "@/components/layout/info-page";
import { getMessages } from "@/i18n/server";
import { StatusChip, type ChipStatus } from "./status-chip";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.pages.a11y.title} · ${m.common.app.name}` };
}

const card = "rounded-[20px] bg-surface-raised p-4 ring-1 ring-border/70 break-inside-avoid";

export default async function AccessibilityStatementPage() {
  const m = await getMessages();
  const t = m.pages.a11y;
  const sections = [t.conformity, t.works, t.limits, t.unverified, t.report, t.appeal];

  const toc = (
    <ol className="space-y-0.5 text-body-sm">
      {sections.map((section) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            className="block rounded-xl px-3 py-2.5 font-medium text-foreground/85 hover:bg-muted hover:text-foreground lg:py-1.5"
          >
            {section.title}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <InfoPage title={t.title} backLabel={m.pages.back} wide>
      <div className="lg:mt-4 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-10">
        <nav aria-label={t.tocTitle} className="mt-2 print:hidden lg:sticky lg:top-20 lg:mt-0">
          <details className="group rounded-[20px] bg-surface-raised ring-1 ring-border/70 lg:hidden">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between rounded-[20px] px-4 text-body-sm font-semibold [&::-webkit-details-marker]:hidden">
              {t.tocTitle}
              <CaretDown weight="bold" className="size-4 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="px-1 pb-2">{toc}</div>
          </details>
          <div className="hidden lg:block">
            <p className="mb-2 px-3 text-caption font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              {t.tocTitle}
            </p>
            {toc}
          </div>
        </nav>

        <div className="min-w-0 max-w-[42rem]">
          <p className="mt-2 text-body text-foreground/85 lg:mt-0">{t.lead}</p>
          <p className="mt-3 flex items-center gap-2 text-caption text-muted-foreground">
            <CalendarBlank weight="bold" className="size-4 shrink-0" aria-hidden />
            {t.updatedLabel}: <time dateTime={t.updatedIso}>{t.updated}</time>
          </p>

          <section id={t.conformity.id} className="mt-6 scroll-mt-20 rounded-[20px] bg-primary-container p-4">
            <h2 className="flex items-center gap-2 text-body font-semibold">
              <Scales weight="fill" className="size-6 shrink-0 text-primary" aria-hidden />
              {t.conformity.title}
            </h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-caption font-semibold tracking-[0.06em] text-foreground/70 uppercase">{t.conformity.targetLabel}</dt>
                <dd className="mt-0.5 text-body-sm font-semibold">{t.conformity.target}</dd>
              </div>
              <div>
                <dt className="text-caption font-semibold tracking-[0.06em] text-foreground/70 uppercase">{t.conformity.stateLabel}</dt>
                <dd className="mt-0.5 flex items-start gap-1.5 text-body-sm font-semibold">
                  <Warning weight="fill" className="mt-0.5 size-[18px] shrink-0 text-foreground" aria-hidden />
                  {t.conformity.state}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-body-sm text-foreground/85">{t.conformity.body}</p>
          </section>

          <InfoSection title={t.works.title} id={t.works.id}>
            <p className="mb-3 text-body-sm text-muted-foreground">{t.works.intro}</p>
            <ul className="space-y-2.5">
              {t.works.items.map(([title, body]) => (
                <li key={title} className={card}>
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <h3 className="text-body font-semibold">{title}</h3>
                    <StatusChip status="done" label={t.statusLabel.done} />
                  </div>
                  <p className="mt-1 text-body-sm text-foreground/80">{body}</p>
                </li>
              ))}
            </ul>
          </InfoSection>

          <InfoSection title={t.limits.title} id={t.limits.id}>
            <p className="mb-3 text-body-sm text-muted-foreground">{t.limits.intro}</p>
            <ul className="space-y-2.5">
              {t.limits.items.map(([status, title, body]) => (
                <li key={title} className={card}>
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <h3 className="text-body font-semibold">{title}</h3>
                    <StatusChip
                      status={status as ChipStatus}
                      label={t.statusLabel[status as keyof typeof t.statusLabel]}
                    />
                  </div>
                  <p className="mt-1 text-body-sm text-foreground/80">{body}</p>
                </li>
              ))}
            </ul>
          </InfoSection>

          <InfoSection title={t.unverified.title} id={t.unverified.id}>
            <p className="mb-3 text-body-sm text-muted-foreground">{t.unverified.intro}</p>
            <ul className="divide-y divide-border rounded-[20px] bg-surface-raised ring-1 ring-border/70">
              {t.unverified.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5 px-4 py-3 text-body-sm">
                  <Badge variant="outline" className="mt-0.5 h-auto shrink-0 text-caption">
                    <Clock weight="bold" className="size-4!" aria-hidden />
                    <span>{t.unverified.badge}</span>
                  </Badge>
                  {item}
                </li>
              ))}
            </ul>
          </InfoSection>

          <InfoSection title={t.report.title} id={t.report.id}>
            <div className={cn(card, "space-y-2 text-body-sm text-foreground/85")}>
              {t.report.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </InfoSection>

          <InfoSection title={t.appeal.title} id={t.appeal.id}>
            <div className={cn(card, "space-y-2 text-body-sm text-foreground/85")}>
              {t.appeal.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </InfoSection>
        </div>
      </div>
    </InfoPage>
  );
}
