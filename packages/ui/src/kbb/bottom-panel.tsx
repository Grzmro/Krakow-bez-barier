"use client";

import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
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
 * Non-modal bottom sheet for map screens: two heights (three with `stowed`), switched by buttons;
 * the arrow keys on the grabber (and ArrowUp on the stowed bar's button) step between them.
 * A vertical swipe on the grabber row or the stowed bar is a shortcut on top of them, never the only
 * way (WCAG 2.5.7). Like iOS Maps, a drag on the list resizes the panel when the list can't take it:
 * down while scrolled to the top, up while the panel isn't fully expanded; otherwise the list scrolls.
 * Absolutely positioned — put it inside a `relative` container. The map behind stays interactive.
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

  function onArrowKey(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const next = order[order.indexOf(current) + (event.key === "ArrowUp" ? 1 : -1)];
    if (next) settle(next);
  }

  const panelRef = useRef<HTMLElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { rowHandlers, onClickCapture } = usePanelSwipe({ panelRef, probeRef, rowRef, scrollerRef, heights, order, current, settle });
  const style = { height: heights[current] } satisfies CSSProperties;
  return (
    <>
      <section
        ref={panelRef}
        aria-label={label}
        data-expanded={expanded}
        data-stowed={isStowed}
        style={style}
        onClickCapture={onClickCapture}
        className={cn(
          "group/panel absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-(--radius-sheet) bg-card text-card-foreground shadow-sheet transition-[height] duration-[420ms] ease-(--ease-out-soft)",
          className,
        )}
      >
        {isStowed && stowLabels ? (
          <div
            ref={rowRef}
            {...rowHandlers}
            className={cn("relative flex h-full max-h-18 shrink-0 touch-none items-center gap-3 px-4 pt-2 select-none", headerClassName)}
          >
            <span aria-hidden className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-border-strong" />
            <p className="min-w-0 flex-1 truncate pt-1 text-body font-semibold">{stowedSummary}</p>
            <Button
              ref={showRef}
              aria-expanded={false}
              aria-keyshortcuts="ArrowUp"
              onClick={() => onStowedChange?.(false)}
              onKeyDown={onArrowKey}
            >
              {stowLabels.show}
            </Button>
          </div>
        ) : (
          <div
            ref={rowRef}
            {...rowHandlers}
            className={cn("relative flex h-12 shrink-0 touch-none items-center justify-center select-none", headerClassName)}
          >
            <button
              type="button"
              aria-expanded={expanded}
              aria-keyshortcuts="ArrowUp ArrowDown"
              onClick={() => onExpandedChange(!expanded)}
              onKeyDown={onArrowKey}
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
          ref={scrollerRef}
          tabIndex={0}
          role="group"
          aria-label={label}
          inert={isStowed}
          aria-hidden={isStowed || undefined}
          className={cn(
            "relative min-h-0 flex-1 overflow-y-auto overscroll-contain",
            // Scrolled to the top of a panel that isn't fully expanded, every vertical drag on the list resizes the panel:
            // say so in CSS too, so the browser can't start a page or list pan before the touch listener runs.
            "group-data-[expanded=false]/panel:data-swipe-top:[touch-action:pan-x_pinch-zoom]",
            isStowed &&
              "invisible h-0 flex-none group-data-dragging/panel:visible group-data-dragging/panel:h-auto group-data-dragging/panel:flex-1",
          )}
        >
          {children}
        </div>
        {footer}
      </section>
      {/* Resolves the state heights (%, calc, env) in the panel's container, without the panel's transition. */}
      <div ref={probeRef} aria-hidden className={cn("pointer-events-none invisible absolute bottom-0 left-0 w-px transition-none", headerClassName)} />
    </>
  );
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

type Drag = {
  startY: number;
  startHeight: number;
  stops: number[];
  samples: { t: number; y: number }[];
  active: boolean;
  follow: boolean;
};

/** A touch on the list, until it is known whether it scrolls the list or resizes the panel. */
type ListTouch = { id: number; x: number; y: number; mode: "undecided" | "panel" | "native" };

/**
 * Swipe of the panel height, from pointer events on the top row and from touch events on the list.
 * While dragging, the height is written straight to the DOM (no React render per move); on release
 * the panel snaps to a state through `settle`.
 *
 * WebKit pans the page for any touchmove nobody cancels, whatever pointer events and `touch-action`
 * say, so native non-passive `touchmove` listeners cancel the moves that belong to the panel: every
 * move of a touch that began on the top row, and the moves of a list drag taken over by the panel.
 * `touchstart` is never cancelled, so taps on the buttons still click.
 */
function usePanelSwipe({
  panelRef,
  probeRef,
  rowRef,
  scrollerRef,
  heights,
  order,
  current,
  settle,
}: {
  panelRef: RefObject<HTMLElement | null>;
  probeRef: RefObject<HTMLDivElement | null>;
  rowRef: RefObject<HTMLDivElement | null>;
  scrollerRef: RefObject<HTMLDivElement | null>;
  heights: Record<PanelState, string>;
  order: PanelState[];
  current: PanelState;
  settle: (state: PanelState) => void;
}) {
  const drag = useRef<Drag | null>(null);
  const pointerId = useRef<number | null>(null);
  // Until when (performance.now) a click in the panel is the tail of a swipe, not a press.
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

  function heightAt(d: Drag, y: number) {
    const min = Math.min(...d.stops);
    const max = Math.max(...d.stops);
    return Math.min(max, Math.max(min, d.startHeight + d.startY - y));
  }

  /** Swipes are off while the top row is hidden (the desktop side panel has a fixed height). */
  function enabled() {
    return Boolean(panelRef.current && probeRef.current && rowRef.current?.getClientRects().length);
  }

  function start(y: number, t: number) {
    drag.current = {
      startY: y,
      startHeight: panelRef.current!.getBoundingClientRect().height,
      stops: [],
      samples: [{ t, y }],
      active: false,
      follow: !reducedMotion(),
    };
  }

  /** Follows the finger; returns true once the move is a swipe (past the slop). */
  function move(y: number, t: number): boolean {
    const d = drag.current;
    const panel = panelRef.current;
    if (!d || !panel) return false;
    if (!d.active) {
      if (Math.abs(y - d.startY) < DRAG_SLOP) return false;
      d.active = true;
      d.stops = measure();
      if (d.follow) panel.style.transition = "none";
      // Lets the list show while the stowed bar is pulled up; it stays inert until the panel settles.
      if (d.follow && current === "stowed") panel.dataset.dragging = "";
    }
    d.samples.push({ t, y });
    if (d.samples.length > 20) d.samples.shift();
    if (d.follow) panel.style.height = `${heightAt(d, y)}px`;
    return true;
  }

  function release(end: { t: number; y: number } | null) {
    const d = drag.current;
    drag.current = null;
    const panel = panelRef.current;
    if (!d?.active || !panel) return;
    swallowUntil.current = performance.now() + 400;
    if (end) d.samples.push(end);
    const last = d.samples.at(-1)!;
    const next = end ? order[snapPanel(d.stops, heightAt(d, last.y), releaseVelocity(d.samples))]! : current;
    // React skips the style write when the state does not change, so the dragged px height is reset here.
    panel.style.transition = "";
    panel.style.height = heights[next];
    delete panel.dataset.dragging;
    settle(next);
  }

  // The native listeners are added once; they reach this render's state through the ref.
  const latest = useRef({ enabled, start, move, release, current, order });
  latest.current = { enabled, start, move, release, current, order };

  useEffect(() => {
    const panel = panelRef.current;
    const scroller = scrollerRef.current;
    if (!panel || !scroller) return;
    const syncTop = () => scroller.toggleAttribute("data-swipe-top", scroller.scrollTop <= 0 && latest.current.enabled());
    syncTop();
    scroller.addEventListener("scroll", syncTop, { passive: true });
    // The top row hides and shows with the layout (desktop side panel), which resizes the panel.
    const resize = new ResizeObserver(syncTop);
    resize.observe(panel);
    let rowTouch = false;
    let list: ListTouch | null = null;

    function onTouchStart(event: TouchEvent) {
      const api = latest.current;
      const touch = event.touches[0];
      if (event.touches.length !== 1 || !touch || !api.enabled()) {
        if (list?.mode === "panel") api.release(null);
        rowTouch = false;
        list = null;
        return;
      }
      const target = event.target as Node;
      rowTouch = Boolean(rowRef.current?.contains(target));
      list = scrollerRef.current?.contains(target) ? { id: touch.identifier, x: touch.clientX, y: touch.clientY, mode: "undecided" } : null;
    }

    function onTouchMove(event: TouchEvent) {
      if (rowTouch) {
        if (event.cancelable) event.preventDefault();
        return;
      }
      if (!list || list.mode === "native") return;
      const api = latest.current;
      const touch = Array.from(event.changedTouches).find((t) => t.identifier === list!.id);
      if (!touch) return;
      if (list.mode === "undecided") {
        const dx = touch.clientX - list.x;
        const dy = touch.clientY - list.y;
        if (dx === 0 && dy === 0) return;
        const at = api.order.indexOf(api.current);
        const takeOver =
          Math.abs(dy) > Math.abs(dx) && (dy > 0 ? scroller!.scrollTop <= 0 && at > 0 : at < api.order.length - 1);
        if (!takeOver || !event.cancelable) {
          list.mode = "native";
          return;
        }
        list.mode = "panel";
        api.start(list.y, event.timeStamp);
      }
      event.preventDefault();
      api.move(touch.clientY, event.timeStamp);
    }

    function onTouchEnd(event: TouchEvent) {
      rowTouch = false;
      const current = list;
      list = null;
      if (current?.mode !== "panel") return;
      const touch = Array.from(event.changedTouches).find((t) => t.identifier === current.id);
      latest.current.release(event.type === "touchend" && touch ? { t: event.timeStamp, y: touch.clientY } : null);
    }

    panel.addEventListener("touchstart", onTouchStart, { passive: true });
    panel.addEventListener("touchmove", onTouchMove, { passive: false });
    panel.addEventListener("touchend", onTouchEnd);
    panel.addEventListener("touchcancel", onTouchEnd);
    return () => {
      scroller.removeEventListener("scroll", syncTop);
      resize.disconnect();
      panel.removeEventListener("touchstart", onTouchStart);
      panel.removeEventListener("touchmove", onTouchMove);
      panel.removeEventListener("touchend", onTouchEnd);
      panel.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [panelRef, rowRef, scrollerRef]);

  const rowHandlers = {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      swallowUntil.current = 0;
      if (!event.isPrimary || event.button !== 0 || !enabled()) return;
      pointerId.current = event.pointerId;
      start(event.clientY, event.timeStamp);
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (pointerId.current !== event.pointerId) return;
      const wasActive = drag.current?.active;
      if (move(event.clientY, event.timeStamp) && !wasActive) event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      if (pointerId.current !== event.pointerId) return;
      pointerId.current = null;
      release({ t: event.timeStamp, y: event.clientY });
    },
    onPointerCancel(event: PointerEvent<HTMLElement>) {
      if (pointerId.current !== event.pointerId) return;
      pointerId.current = null;
      release(null);
    },
  };

  // A swipe that starts on a button must not also press it; a keyboard press (detail 0) always goes through.
  function onClickCapture(event: MouseEvent<HTMLElement>) {
    if (event.detail === 0 || performance.now() > swallowUntil.current) return;
    swallowUntil.current = 0;
    event.preventDefault();
    event.stopPropagation();
  }

  return { rowHandlers, onClickCapture };
}
