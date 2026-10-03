"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { cn } from "../cn";
import { Button } from "../components/button";

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
  /** Third state (needs `onStowedChange` and `stowLabels`, otherwise ignored): a bar with the summary and a "show" button, the content inert. */
  stowed?: boolean;
  onStowedChange?: (stowed: boolean) => void;
  /** Names of the buttons that hide the panel to the bar and bring it back, e.g. "Schowaj listę" / "Pokaż listę". */
  stowLabels?: { hide: string; show: string };
  /** Text in the bar, e.g. the result count. */
  stowedSummary?: ReactNode;
  stowedHeight?: string;
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
  stowed = false,
  onStowedChange,
  stowLabels,
  stowedSummary,
  stowedHeight = "4.5rem",
}: BottomPanelProps) {
  const canStow = Boolean(onStowedChange && stowLabels);
  const isStowed = canStow && stowed;
  const showRef = useRef<HTMLButtonElement>(null);
  const hideRef = useRef<HTMLButtonElement>(null);
  const wasStowed = useRef(isStowed);
  useEffect(() => {
    if (wasStowed.current === isStowed) return;
    wasStowed.current = isStowed;
    (isStowed ? showRef : hideRef).current?.focus({ preventScroll: true });
  }, [isStowed]);
  const style = { height: isStowed ? stowedHeight : expanded ? expandedHeight : collapsedHeight } satisfies CSSProperties;
  return (
    <section
      aria-label={label}
      data-expanded={expanded}
      data-stowed={isStowed}
      style={style}
      className={cn(
        "absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-(--radius-sheet) bg-card text-card-foreground shadow-sheet transition-[height] duration-[420ms] ease-(--ease-out-soft)",
        className,
      )}
    >
      {isStowed && stowLabels ? (
        <div className={cn("relative flex h-full items-center gap-3 px-4 pt-2", headerClassName)}>
          <span aria-hidden className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-border-strong" />
          <p className="min-w-0 flex-1 truncate pt-1 text-body font-semibold">{stowedSummary}</p>
          <Button ref={showRef} aria-expanded={false} onClick={() => onStowedChange?.(false)}>
            {stowLabels.show}
          </Button>
        </div>
      ) : (
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
          {headerRight || canStow ? (
            <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1">
              {headerRight}
              {canStow && stowLabels ? (
                <Button
                  ref={hideRef}
                  aria-expanded
                  variant="ghost"
                  size="icon"
                  aria-label={stowLabels.hide}
                  onClick={() => onStowedChange?.(true)}
                  className="size-10"
                >
                  <CaretDown weight="bold" aria-hidden />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
      {/* Focusable so keyboard users can scroll it even when it holds no focusable content (WCAG 2.1.1). */}
      <div
        tabIndex={0}
        role="group"
        aria-label={label}
        inert={isStowed}
        aria-hidden={isStowed || undefined}
        className={cn("relative min-h-0 flex-1 overflow-y-auto overscroll-contain", isStowed && "invisible h-0 flex-none")}
      >
        {children}
      </div>
      {footer}
    </section>
  );
}
