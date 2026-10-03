"use client";

import type { CSSProperties } from "react";
import { CheckCircle, CircleNotch, Info, Prohibit, Warning } from "@phosphor-icons/react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      position="bottom-center"
      icons={{
        success: <CheckCircle weight="fill" className="size-5" />,
        info: <Info weight="fill" className="size-5" />,
        warning: <Warning weight="fill" className="size-5" />,
        error: <Prohibit weight="fill" className="size-5" />,
        loading: <CircleNotch className="size-5 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--ink)",
          "--normal-text": "var(--ink-foreground)",
          "--normal-border": "transparent",
          "--border-radius": "20px",
        } as CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
export { toast } from "sonner";
