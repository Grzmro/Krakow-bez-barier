"use client";

import { useSyncExternalStore } from "react";
import { Bed, Copy, LockSimple } from "@phosphor-icons/react";
import { Button, toast, useAnnounce } from "@krakow-bez-barier/ui";
import { SampleTag } from "@/components/kbb";
import { InfoSection } from "@/components/layout/info-page";
import { pl } from "@/i18n/pl";
import { routes } from "@/lib/routes";
import { useWidgetCard } from "@/lib/use-widget-card";

const t = pl.business.page;

const DEMO_PLACE_ID = "hotel-przyklad";
const IFRAME_HEIGHT = 640;

const noSubscribe = () => () => {};

/** The page's own origin, so the snippet works wherever the app is deployed; empty during SSR. */
function useOrigin() {
  return useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => "",
  );
}

function embedSnippet(origin: string, placeId: string, title: string) {
  return `<iframe src="${origin}${routes.widget(placeId)}"
        title="${title}"
        width="100%" height="${IFRAME_HEIGHT}"
        style="border:0;max-width:28rem"
        loading="lazy"></iframe>`;
}

function CodeBlock({ code, label, copyLabel }: { code: string; label: string; copyLabel: string }) {
  const announce = useAnnounce();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast(t.copied);
      announce(t.copied);
    } catch {
      toast(t.copyFailed);
      announce(t.copyFailed);
    }
  };
  return (
    <div className="relative mt-3 overflow-hidden rounded-[20px] bg-ink text-ink-foreground">
      <pre
        tabIndex={0}
        role="region"
        aria-label={label}
        className="max-h-80 overflow-auto p-4 pr-14 font-mono text-[12px] leading-5 outline-none focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-ring"
      >
        {code}
      </pre>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={copyLabel}
        onClick={copy}
        className="absolute top-2 right-2 bg-ink-foreground/10 text-ink-foreground hover:bg-ink-foreground/20 hover:text-ink-foreground"
      >
        <Copy weight="bold" />
      </Button>
    </div>
  );
}

export function BusinessScreen() {
  const origin = useOrigin();
  const widget = useWidgetCard(DEMO_PLACE_ID);
  const iframeTitle = t.iframeTitle(t.hotelName);

  return (
    <>
      <p className="text-body text-foreground/85">{t.lead}</p>

      <InfoSection title={t.previewTitle}>
        <p className="mb-3 text-caption text-muted-foreground">{t.previewNote}</p>
        <div className="overflow-hidden rounded-[24px] bg-muted ring-1 ring-border">
          <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2.5">
            <p className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full bg-muted px-3 text-caption text-muted-foreground">
              <LockSimple weight="fill" className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{t.hotelUrl}</span>
            </p>
            <SampleTag />
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

      <InfoSection title={t.codeTitle}>
        <p className="text-body-sm text-foreground/85">{t.codeLead}</p>
        <CodeBlock code={embedSnippet(origin, DEMO_PLACE_ID, iframeTitle)} label={t.codeLabel} copyLabel={t.copyCode} />
      </InfoSection>

      <InfoSection title={t.apiTitle}>
        <p className="text-body-sm text-foreground/85">{t.apiLead}</p>
        <p className="mt-3 font-mono text-caption font-semibold break-all">{t.apiRequest(DEMO_PLACE_ID)}</p>
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
    </>
  );
}
