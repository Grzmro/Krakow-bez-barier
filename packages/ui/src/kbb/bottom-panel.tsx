"use client";

import { useEffect, useRef, type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { cn } from "../cn";
import { Button } from "../components/button";
import { DRAG_SLOP, releaseVelocity, snapPanel } from "./panel-snap";

type PanelState = "stowed" | "collapsed" | "expanded";

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
 * Non-modal bottom sheet for map screens: two heights (three with `stowed`), switched by buttons.
 * A vertical swipe on the grabber row or the stowed bar is a shortcut on top of them, never the only
 * way (WCAG 2.5.7); the scrolling content never swipes the panel. Absolutely positioned — put it
 * inside a `relative` container. The content scrolls and the map behind stays interactive.
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
  const heights: Record<PanelState, string> = { stowed: stowedHeight, collapsed: collapsedHeight, expanded: expandedHeight };
  const current: PanelState = isStowed ? "stowed" : expanded ? "expanded" : "collapsed";
  const order: PanelState[] = canStow ? ["stowed", "collapsed", "expanded"] : ["collapsed", "expanded"];

  function settle(next: PanelState) {
    if (next === "stowed") return onStowedChange?.(true);
    if (next !== current) onExpandedChange(next === "expanded");
    if (isStowed) onStowedChange?.(false);
  }

  const panelRef = useRef<HTMLElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const swipeHandlers = usePanelSwipe({ panelRef, probeRef, heights, order, current, settle });
  const style = { height: heights[current] } satisfies CSSProperties;
  return (
    <>
      <section
        ref={panelRef}
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
          <div
            {...swipeHandlers}
            className={cn("relative flex h-full max-h-18 shrink-0 touch-none items-center gap-3 px-4 pt-2 select-none", headerClassName)}
          >
            <span aria-hidden className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-border-strong" />
            <p className="min-w-0 flex-1 truncate pt-1 text-body font-semibold">{stowedSummary}</p>
            <Button ref={showRef} aria-expanded={false} onClick={() => onStowedChange?.(false)}>
              {stowLabels.show}
            </Button>
          </div>
        ) : (
          <div
            {...swipeHandlers}
            className={cn("relative flex h-12 shrink-0 touch-none items-center justify-center select-none", headerClassName)}
          >
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
      {/* Resolves the state heights (%, calc, env) in the panel's container, without the panel's transition. */}
      <div ref={probeRef} aria-hidden className="pointer-events-none invisible absolute bottom-0 left-0 w-px transition-none" />
    </>
  );
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Pointer-driven swipe of the panel height. While dragging, the height is written straight to the
 * DOM (no React render per move); on release the panel snaps to a state through `settle`.
 */
function usePanelSwipe({
  panelRef,
  probeRef,
  heights,
  order,
  current,
  settle,
}: {
  panelRef: RefObject<HTMLElement | null>;
  probeRef: RefObject<HTMLDivElement | null>;
  heights: Record<PanelState, string>;
  order: PanelState[];
  current: PanelState;
  settle: (state: PanelState) => void;
}) {
  const drag = useRef<{
    id: number;
    startY: number;
    startHeight: number;
    stops: number[];
    samples: { t: number; y: number }[];
    active: boolean;
    follow: boolean;
  } | null>(null);
  // Until when (performance.now) a click on the row is the tail of a swipe, not a press.
  const swallowUntil = useRef(0);

  function measure(): number[] {
    const probe = probeRef.current!;
    const px = order.map((state) => {
      probe.style.height = heights[state];
      return probe.getBoundingClientRect().height;
    });
    probe.style.height = "";
    return px;
  }

  function heightAt(d: NonNullable<typeof drag.current>, y: number) {
    const min = Math.min(...d.stops);
    const max = Math.max(...d.stops);
    return Math.min(max, Math.max(min, d.startHeight + d.startY - y));
  }

  function release(cancelled: boolean) {
    const d = drag.current;
    drag.current = null;
    const panel = panelRef.current;
    if (!d?.active || !panel) return;
    swallowUntil.current = performance.now() + 400;
    const last = d.samples.at(-1)!;
    const next = cancelled ? current : order[snapPanel(d.stops, heightAt(d, last.y), releaseVelocity(d.samples))]!;
    // React skips the style write when the state does not change, so the dragged px height is reset here.
    panel.style.transition = "";
    panel.style.height = heights[next];
    settle(next);
  }

  const handlers = {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      swallowUntil.current = 0;
      if (!event.isPrimary || event.button !== 0 || !panelRef.current || !probeRef.current) return;
      drag.current = {
        id: event.pointerId,
        startY: event.clientY,
        startHeight: panelRef.current.getBoundingClientRect().height,
        stops: [],
        samples: [{ t: event.timeStamp, y: event.clientY }],
        active: false,
        follow: !reducedMotion(),
      };
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const d = drag.current;
      const panel = panelRef.current;
      if (!d || d.id !== event.pointerId || !panel) return;
      if (!d.active) {
        if (Math.abs(event.clientY - d.startY) < DRAG_SLOP) return;
        d.active = true;
        d.stops = measure();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        if (d.follow) panel.style.transition = "none";
      }
      d.samples.push({ t: event.timeStamp, y: event.clientY });
      if (d.samples.length > 20) d.samples.shift();
      if (d.follow) panel.style.height = `${heightAt(d, event.clientY)}px`;
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      d.samples.push({ t: event.timeStamp, y: event.clientY });
      release(false);
    },
    onPointerCancel(event: PointerEvent<HTMLElement>) {
      if (drag.current?.id === event.pointerId) release(true);
    },
    // A swipe that starts on a button must not also press it; a keyboard press (detail 0) always goes through.
    onClickCapture(event: MouseEvent<HTMLElement>) {
      if (event.detail === 0 || performance.now() > swallowUntil.current) return;
      swallowUntil.current = 0;
      event.preventDefault();
      event.stopPropagation();
    },
  };

  return handlers;
}
