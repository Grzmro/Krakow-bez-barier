"use client";

import { useMemo } from "react";
import { Buildings, Copy } from "@phosphor-icons/react";
import type { Place } from "@krakow-bez-barier/contracts";
import { Button, buttonVariants, cn, toast, useAnnounce } from "@krakow-bez-barier/ui";
import { useMessages } from "@/i18n/client";
import { buildCityReport, cityReportMailto, cityReportText, isReportAddress } from "@/lib/city-report";
import { config } from "@/lib/config";
import { copyText } from "@/lib/copy-text";
import { routes } from "@/lib/routes";

/** "Zgłoś miastu": the barrier as a ready message — opens the visitor's mail app when the city's address is configured, else copies it. */
export function CityReportSection({ place }: { place: Place }) {
  const t = useMessages().place.cityReport;
  const announce = useAnnounce();
  const report = useMemo(
    () => buildCityReport({ place, url: new URL(routes.place(place.id), window.location.origin).toString(), locale: "pl" }),
    [place],
  );
  const mailto = cityReportMailto(config.cityReportAddress, report);
  const configured = isReportAddress(config.cityReportAddress) && mailto !== null;

  const copy = async () => {
    const message = (await copyText(cityReportText(report))) ? t.copied : t.copyFailed;
    toast(message);
    announce(message);
  };

  return (
    <section aria-labelledby="place-city-report" className="mt-5 rounded-2xl bg-surface-raised p-4 ring-1 ring-border">
      <h2 id="place-city-report" className="flex items-center gap-2 text-body-sm font-semibold">
        <Buildings weight="fill" className="size-5 text-primary" aria-hidden />
        {t.heading}
      </h2>
      <p className="mt-1 text-caption text-muted-foreground">{t.hint}</p>
      {configured ? null : (
        <p id="place-city-report-note" className="mt-1 text-caption text-muted-foreground">
          {t.noAddress}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {configured ? (
          <>
            <a href={mailto} className={cn(buttonVariants({ size: "sm" }))}>
              <Buildings weight="bold" aria-hidden />
              {t.send}
            </a>
            <Button variant="outline" size="sm" onClick={copy}>
              <Copy weight="bold" />
              {t.copy}
            </Button>
          </>
        ) : (
          <Button size="sm" aria-describedby="place-city-report-note" onClick={copy}>
            <Copy weight="bold" />
            {t.send}
          </Button>
        )}
      </div>
      <details className="mt-3 text-caption">
        <summary className="cursor-pointer font-semibold">{t.preview}</summary>
        <p className="mt-2 text-muted-foreground">{t.previewNote}</p>
        <pre lang="pl" className="mt-2 max-h-72 overflow-auto rounded-xl bg-muted p-3 break-words whitespace-pre-wrap">
          {cityReportText(report)}
        </pre>
      </details>
    </section>
  );
}
