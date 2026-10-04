"use client";

import type { ComponentProps } from "react";
import { cn } from "../cn";
import { useFieldControl } from "./field";

export const textareaClass =
  "block min-h-24 max-h-64 w-full resize-none rounded-2xl border-[1.5px] border-input bg-card px-4 py-3 text-body text-foreground [field-sizing:content] transition-[border-color,background-color] duration-(--duration-fast) outline-none placeholder:text-muted-foreground hover:border-foreground/70 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 read-only:border-dashed read-only:bg-muted aria-invalid:border-destructive aria-invalid:hover:border-destructive";

/** Multi-line field that grows with its text (up to 16 rem, then scrolls). Wrap it in `Field`. */
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  const control = useFieldControl(props);
  return <textarea data-slot="textarea" {...props} {...control} className={cn(textareaClass, className)} />;
}
