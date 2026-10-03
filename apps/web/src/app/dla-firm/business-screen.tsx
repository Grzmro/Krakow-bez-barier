"use client";

import { Bed, LockSimple } from "@phosphor-icons/react";
import { API_BASE_PATH } from "@krakow-bez-barier/contracts";
import { InfoSection } from "@/components/layout/info-page";
import { useMessages } from "@/i18n/client";
import { routes } from "@/lib/routes";
import { useOrigin } from "@/lib/use-origin";
import { useWidgetCard } from "@/lib/use-widget-card";
import { CodeBlock } from "./code-block";
import { EventLinkGenerator } from "./event-link-generator";

const DEMO_PLACE_ID = "hotel-przyklad";
const IFRAME_HEIGHT = 640;

function embedSnippet(origin: string, placeId: string, title: string) {
  return `<iframe src="${origin}${routes.widget(placeId)}"
        title="${title}"
        width="100%" height="${IFRAME_HEIGHT}"
        style="border:0;max-width:28rem"
        loading="lazy"></iframe>`;
}

export function BusinessScreen() {
  const m = useMessages();
  const t = m.business.page;
  const origin = useOrigin();
  const widget = useWidgetCard(DEMO_PLACE_ID);
  const iframeTitle = t.iframeTitle(t.hotelName);

  return (
    <>
      <p className="max-w-3xl text-body text-foreground/85">{t.lead}</p>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-x-10">
        <div>
          <InfoSection title={t.previewTitle}>
            <p className="mb-3 text-caption text-muted-foreground">{t.previewNote}</p>
            <div className="overflow-hidden rounded-[24px] bg-muted ring-1 ring-border">
              <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2.5">
                <p className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full bg-muted px-3 text-caption text-muted-foreground">
                  <LockSimple weight="fill" className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{t.hotelUrl}</span>
                </p>
              </div>
              <div className="p-3">
                <div aria-hidden className="grid h-24 place-items-center rounded-2xl bg-primary-container text-primary">
                  <Bed weight="duotone" className="size-10" />
                </div>
                <p className="mt-3 font-display text-title font-bold">{t.hotelName}</p>
                <p className="mt-0.5 text-caption text-muted-foreground">{t.hotelRoom}</p>
              </div>
              <iframe
                src={routes.widget(DEMO_PLACE_ID)}
                title={iframeTitle}
                height={IFRAME_HEIGHT}
                className="block w-full border-0"
              />
            </div>
          </InfoSection>
        </div>

        <div>
          <InfoSection title={t.codeTitle}>
            <p className="text-body-sm text-foreground/85">{t.codeLead}</p>
            <CodeBlock
              code={embedSnippet(origin, DEMO_PLACE_ID, iframeTitle)}
              label={t.codeLabel}
              copyLabel={t.copyCode}
            />
          </InfoSection>

          <InfoSection title={m.business.event.title}>
            <EventLinkGenerator />
          </InfoSection>

          <InfoSection title={t.apiTitle}>
            <p className="text-body-sm text-foreground/85">{t.apiLead}</p>
            <p className="mt-3 font-mono text-caption font-semibold break-all">{`${t.apiMethod} ${API_BASE_PATH}/widget/${encodeURIComponent(DEMO_PLACE_ID)}`}</p>
            {widget.data ? (
              <CodeBlock code={JSON.stringify(widget.data, null, 2)} label={t.apiLabel} copyLabel={t.copyApi} />
            ) : (
              <p role="status" className="mt-3 text-body-sm text-muted-foreground">
                {t.apiLoading}
              </p>
            )}
          </InfoSection>

          <InfoSection title={t.pricingTitle}>
            <dl className="space-y-2 rounded-[20px] border border-dashed border-border-strong/50 p-4 text-body-sm">
              <div className="flex flex-wrap justify-between gap-x-3">
                <dt>{t.pricingCard}</dt>
                <dd className="font-display font-extrabold tabular-nums">{t.pricingCardPrice}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-3">
                <dt>{t.pricingAudit}</dt>
                <dd className="font-display font-extrabold tabular-nums">{t.pricingAuditPrice}</dd>
              </div>
            </dl>
            <p className="mt-2 text-caption text-muted-foreground">{t.pricingNote}</p>
          </InfoSection>
        </div>
      </div>
    </>
  );
}
