"use client";

import { Fragment } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { Button, LogoMark, buttonVariants, cn } from "@krakow-bez-barier/ui";
import { ReliabilityBadge, SampleTag, SourceText, UnknownFactsItem } from "@/components/kbb";
import { useLocale, useMessages } from "@/i18n/client";
import { splitUnknown } from "@/lib/place-facts";
import { routes } from "@/lib/routes";
import { useWidgetCard } from "@/lib/use-widget-card";
import { widgetFactView } from "@/lib/widget-facts";

export function WidgetCard({ placeId }: { placeId: string }) {
  const m = useMessages();
  const t = m.business.widget;
  const locale = useLocale();
  const query = useWidgetCard(placeId);

  if (query.isPending) {
    return (
      <p role="status" className="p-4 text-body-sm text-muted-foreground">
        {t.loading}
      </p>
    );
  }
  if (query.isError) {
    return (
      <div role="alert" className="space-y-3 p-4">
        <p className="text-body-sm">{t.loadError}</p>
        <Button variant="outline" size="sm" onClick={() => query.refetch()}>
          {t.retry}
        </Button>
      </div>
    );
  }
  if (!query.data) {
    return <p className="p-4 text-body-sm text-muted-foreground">{t.notFound}</p>;
  }

  const card = query.data;
  const { known, unknown } = splitUnknown(card.facts.map((fact) => widgetFactView(fact, locale)));
  return (
    <article aria-labelledby="widget-name" className="rounded-[20px] bg-card p-4 shadow-float ring-1 ring-primary/25">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-caption font-semibold tracking-[0.06em] text-muted-foreground uppercase">{t.heading}</p>
          <h1 id="widget-name" className="font-display text-title font-bold">
            {card.name}
          </h1>
        </div>
        {card.isSample ? <SampleTag className="shrink-0" /> : null}
      </div>
      <p className="mt-1 text-caption text-muted-foreground">{t.noRating}</p>

      <ul aria-label={t.factsLabel} className="mt-3 divide-y divide-border">
        {known.map((fact) => (
          <li key={fact.attribute} className="py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <p className="text-body-sm">
                <span className="text-muted-foreground">{fact.label}:</span>{" "}
                <span className={cn("font-semibold", fact.unknown && "text-muted-foreground")}>{fact.value}</span>
              </p>
              <ReliabilityBadge value={fact.reliability} />
            </div>
            <p className="mt-0.5 text-caption text-muted-foreground">{fact.source ?? t.noSource}</p>
          </li>
        ))}
        <UnknownFactsItem labels={unknown.map((fact) => fact.label)} className="py-2.5" />
      </ul>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
        <a
          href={routes.place(card.placeId)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-10 px-0")}
        >
          {t.fullCard}
          <ArrowSquareOut aria-hidden />
          <span className="sr-only">{t.newTab}</span>
        </a>
        <p className="flex items-center gap-1.5 text-caption font-semibold text-primary">
          <LogoMark className="size-4" />
          {m.common.app.name}
        </p>
      </div>
      <p className="mt-1 text-caption text-muted-foreground">
        {card.attribution.split(" · ").map((part, i) => (
          <Fragment key={i}>
            {i ? " · " : null}
            <SourceText>{part}</SourceText>
          </Fragment>
        ))}
      </p>
    </article>
  );
}
