"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "../cn";

export interface BottomPanelProps {
  /** Accessible name of the panel region, e.g. "Lista miejsc". */
  label: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** Toggle button names: "Rozwiń arkusz" / "Zwiń arkusz". */
  toggleLabels: { expand: string; collapse: string };
  /** CSS heights of the two states (relative to the positioned parent). */
  collapsedHeight?: string;
  expandedHeight?: string;
  headerRight?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Extra classes of the grabber row, e.g. `lg:hidden` when the panel turns into a static side panel. */
  headerClassName?: string;
}

/**
 * Non-modal bottom sheet for map screens: two heights, switched by a button (the grabber), never
 * by a drag-only gesture. Absolutely positioned — put it inside a `relative` container. The content
 * scrolls in both states and the map behind stays interactive.
 */
export function BottomPanel({
  label,
  expanded,
  onExpandedChange,
  toggleLabels,
  collapsedHeight = "45%",
  expandedHeight = "calc(100% - 4rem)",
  headerRight,
  footer,
  children,
  className,
  headerClassName,
}: BottomPanelProps) {
  const style = { height: expanded ? expandedHeight : collapsedHeight } satisfies CSSProperties;
  return (
    <section
      aria-label={label}
      data-expanded={expanded}
      style={style}
      className={cn(
        "absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-(--radius-sheet) bg-card text-card-foreground shadow-sheet transition-[height] duration-[420ms] ease-(--ease-out-soft)",
        className,
      )}
    >
      <div className={cn("relative flex h-12 shrink-0 items-center justify-center", headerClassName)}>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => onExpandedChange(!expanded)}
          className="flex h-10 w-32 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-offset-0"
        >
          <span aria-hidden className="h-1 w-9 rounded-full bg-border-strong" />
          <span className="sr-only">{expanded ? toggleLabels.collapse : toggleLabels.expand}</span>
        </button>
        {headerRight ? <div className="absolute top-1/2 right-3 -translate-y-1/2">{headerRight}</div> : null}
      </div>
      {/* Focusable so keyboard users can scroll it even when it holds no focusable content (WCAG 2.1.1). */}
      <div
        tabIndex={0}
        role="group"
        aria-label={label}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {children}
      </div>
      {footer}
    </section>
  );
}
