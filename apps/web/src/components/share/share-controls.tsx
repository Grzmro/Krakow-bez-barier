"use client";

import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { Copy, PaperPlaneTilt, ShareNetwork } from "@phosphor-icons/react";
import { Button, toast, useAnnounce } from "@krakow-bez-barier/ui";
import { useMessages } from "@/i18n/client";
import { copyText } from "@/lib/copy-text";
import { QrCode } from "./qr-code";

const noSubscribe = () => () => {};
const hasWebShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

/**
 * "Udostępnij": opens a panel with the link, a QR code, "Kopiuj link" and, where the browser has the Web Share API
 * (phones), "Wyślij…". `children` are the sender's options for the link (e.g. "Dołącz mój start"); the link is built
 * by the caller from them.
 */
export function ShareControls({ buildLink, title, text, children }: { buildLink: () => string; title: string; text: string; children?: ReactNode }) {
  const t = useMessages().share;
  const announce = useAnnounce();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  // The origin is only known in the browser, so the link exists once the panel is open (or a copy is asked for).
  const link = open ? buildLink() : "";
  const canSend = useSyncExternalStore(noSubscribe, hasWebShare, () => false);

  const copy = async () => {
    const message = (await copyText(buildLink())) ? t.copied : t.copyFailed;
    toast(message, { description: buildLink() });
    announce(message);
  };

  const send = async () => {
    try {
      await navigator.share({ title, text, url: buildLink() });
    } catch (error) {
      // Closing the share sheet is a choice, not a failure; anything else falls back to copying.
      if (!(error instanceof DOMException && error.name === "AbortError")) await copy();
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
        <ShareNetwork weight="bold" />
        {t.button}
      </Button>
      {open ? (
        <section id={panelId} aria-label={t.panelLabel} className="basis-full rounded-[20px] bg-surface-raised p-4 shadow-soft ring-1 ring-border/70">
          {children}
          <p className="mt-2 text-caption text-muted-foreground">{t.privacy}</p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <QrCode value={link} label={t.qrLabel} className="size-40 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 basis-48">
              <p className="text-body-sm text-muted-foreground">{t.qrHint}</p>
              <p className="mt-2 text-caption font-semibold">
                <span className="sr-only">{t.linkLabel}: </span>
                <span className="break-all select-all">{link}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {canSend ? (
                  <Button size="sm" onClick={send}>
                    <PaperPlaneTilt weight="bold" />
                    {t.send}
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" onClick={copy}>
                  <Copy weight="bold" />
                  {t.copy}
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
