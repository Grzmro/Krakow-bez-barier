"use client";

import { Copy } from "@phosphor-icons/react";
import { Button, cn, toast, useAnnounce } from "@krakow-bez-barier/ui";
import { useMessages } from "@/i18n/client";

/** Read-only code or link with a copy button; the copy result is shown and announced. */
export function CodeBlock({
  code,
  label,
  copyLabel,
  wrap = false,
}: {
  code: string;
  label: string;
  copyLabel: string;
  /** Wrap long lines (a link) instead of scrolling sideways (code). */
  wrap?: boolean;
}) {
  const t = useMessages().business.page;
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
        className={cn(
          "max-h-80 overflow-auto p-4 pr-14 font-mono text-[12px] leading-5 outline-none focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-ring",
          wrap && "break-all whitespace-pre-wrap",
        )}
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
