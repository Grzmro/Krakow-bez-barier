"use client";

import { Fragment, useEffect, useRef, type Ref, type RefObject } from "react";
import { CaretLeft, CaretRight, CloudSlash, FlagCheckered, MapPin } from "@phosphor-icons/react";
import type { Route } from "@krakow-bez-barier/contracts";
import { Button, cn, LabeledSwitch, StatusIcon, useAnnounce } from "@krakow-bez-barier/ui";
import { useLocale, useMessages } from "@/i18n/client";
import { SampleTag } from "@/components/kbb";
import { formatDate } from "@/lib/place-facts";
import { concerns, provenance, type Concern } from "@/lib/navigation";
import { segmentStatusLabel } from "@/lib/route-speech";
import type { Guidance } from "@/lib/use-guidance";
import { StepList, STATUS_TEXT } from "./route-steps";

/** Guidance in the route panel: the step being walked, what's next, barriers and gaps ahead with their sources, the whole list. */
export function RouteNavigation({
  route,
  guidance,
  loading,
  error,
  selected,
  onSelect,
  onReroute,
  headingRef,
  stepRefs,
}: {
  route: Route | undefined;
  guidance: Guidance;
  loading: boolean;
  error: string | null;
  selected: number | null;
  onSelect: (id: number | null) => void;
  onReroute: () => void;
  headingRef: Ref<HTMLHeadingElement>;
  /** Step buttons by segment id, so a segment picked on the map can focus its step. */
  stepRefs: RefObject<Map<number, HTMLButtonElement>>;
}) {
  const m = useMessages();
  const t = m.route.nav;
  const announce = useAnnounce();
  const { mode, failure, progress, follow, setFollow } = guidance;
  const modeText = mode === "located" ? t.tracking : mode === "locating" ? t.locating : failure === "denied" ? t.manualDenied : t.manualUnavailable;
  const stepText = useStepText(route, progress);

  // Each new step, being off the route, arriving and falling back to manual mode are read out. The live region holds one
  // message, and the switch to manual mode often lands right after step 1 is announced, so it repeats the current step.
  const announced = useRef<{ stepText: string | null; mode: Guidance["mode"] | null }>({ stepText: null, mode: null });
  useEffect(() => {
    const previous = announced.current;
    announced.current = { stepText, mode };
    if (mode === "manual" && previous.mode !== "manual") announce([modeText, stepText].filter(Boolean).join(" "));
    else if (stepText && stepText !== previous.stepText) announce(stepText);
  }, [announce, mode, modeText, stepText]);
  const offRoute = progress?.offRoute ? t.offRoute(progress.offBy ?? 0) : null;
  const offRouteShown = Boolean(offRoute);
  const lastOff = useRef(false);
  useEffect(() => {
    if (offRouteShown && !lastOff.current && offRoute) announce(offRoute);
    lastOff.current = offRouteShown;
  }, [announce, offRoute, offRouteShown]);
  useEffect(() => {
    if (progress?.arrived) announce(t.arrived);
  }, [announce, progress?.arrived, t.arrived]);
  // A short buzz on a new step while walking by GPS (where supported).
  const step = progress?.step;
  useEffect(() => {
    if (mode === "located" && step !== undefined && step > 0) navigator.vibrate?.(150);
  }, [mode, step]);

  const segment = route && progress ? route.segments[progress.step] : undefined;
  const following = route && progress ? route.segments[progress.step + 1] : undefined;
  const { here, ahead } = route && progress ? concerns(route, progress) : { here: null, ahead: null };

  return (
    <section aria-labelledby="guidance-title" className="px-4 pt-1 pb-6 lg:pt-4">
      <h1 id="guidance-title" ref={headingRef} tabIndex={-1} className="font-display text-h2 font-extrabold outline-none">
        {t.title}
      </h1>

      {offRoute ? (
        <div className="mt-3 grid justify-items-start gap-2 rounded-[20px] bg-status-conflict-bg p-4">
          <p className="text-body font-semibold">{offRoute}</p>
          <p id="reroute-hint" className="text-caption text-muted-foreground">
            {t.rerouteHint}
          </p>
          <Button variant="outline" size="sm" aria-describedby="reroute-hint" onClick={onReroute}>
            {t.reroute}
          </Button>
        </div>
      ) : null}

      {loading ? (
        <p className="mt-4 text-body text-muted-foreground">{m.route.loading}</p>
      ) : error ? (
        <div className="mt-4 flex gap-3 rounded-[20px] bg-status-conflict-bg p-4">
          <CloudSlash weight="bold" className="mt-0.5 size-6 shrink-0 text-status-conflict" aria-hidden />
          <p className="text-body font-semibold">{error}</p>
        </div>
      ) : route && progress && segment ? (
        <>
          {progress.arrived ? (
            <p className="mt-3 flex items-center gap-2 rounded-[20px] bg-status-met-bg p-4 text-title font-semibold">
              <FlagCheckered weight="bold" className="size-6 shrink-0" aria-hidden />
              {t.arrived}
            </p>
          ) : (
            <div className="mt-3 rounded-[20px] bg-primary-container p-4">
              <p className="text-caption font-semibold text-muted-foreground">{t.stepOf(progress.step + 1, route.segments.length)}</p>
              <p className="mt-1 font-display text-h2 font-extrabold">{segment.instruction}</p>
              <p className="mt-0.5 text-body-sm">{[segment.name, t.left(progress.toStepEnd)].filter(Boolean).join(" · ")}</p>
              <p className="mt-3 border-t border-primary/20 pt-3 text-title font-semibold">
                {following ? t.thenIn(following.instruction, progress.toStepEnd) : t.destinationIn(progress.toStepEnd)}
              </p>
            </div>
          )}
          {here || ahead ? (
            <ul className="mt-3 space-y-2">
              {here ? <ConcernItem label={t.here} concern={here} /> : null}
              {ahead ? <ConcernItem label={t.ahead(ahead.inMeters)} concern={ahead} /> : null}
            </ul>
          ) : null}
          <p className="mt-3 text-body font-semibold tabular-nums">{t.remaining(progress.remainingMeters, progress.remainingMinutes)}</p>
        </>
      ) : null}

      <p className="mt-4 flex gap-2 text-body-sm text-muted-foreground">
        <MapPin weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden />
        {modeText}
      </p>
      {mode === "located" ? <LabeledSwitch label={t.follow} checked={follow} onCheckedChange={setFollow} className="mt-1" /> : null}

      {route && progress && !loading && !error ? (
        <>
          <h2 className="mt-7 mb-1 text-title font-semibold">{m.route.steps}</h2>
          <StepList route={route} selected={selected} onSelect={onSelect} stepRefs={stepRefs} current={progress.step} />
        </>
      ) : null}
    </section>
  );
}

/** The step as one sentence for the live region: number, instruction, distance left, and its state. */
function useStepText(route: Route | undefined, progress: Guidance["progress"]) {
  const m = useMessages();
  const step = progress?.step;
  const segment = route && step !== undefined ? route.segments[step] : undefined;
  if (!route || !segment || step === undefined) return null;
  const state = `${segmentStatusLabel(m, segment)}${segment.note ? `: ${segment.note}` : ""}`;
  // Distance at the step's start, so the sentence (and the announcement) changes only with the step.
  return `${m.route.nav.stepOf(step + 1, route.segments.length)}: ${segment.instruction}, ${m.route.meters(segment.lengthMeters)}. ${state}.`;
}

function ConcernItem({ label, concern }: { label: string; concern: Concern }) {
  const m = useMessages();
  const locale = useLocale();
  const { segment } = concern;
  const sources = provenance(segment);
  return (
    <li className="flex gap-2 rounded-2xl bg-surface-raised p-3 shadow-soft ring-1 ring-border/70">
      <StatusIcon status={segment.state} className="mt-0.5 size-5 shrink-0" />
      <p className="text-body-sm">
        <strong>{label}:</strong>{" "}
        <span className={cn("font-semibold", STATUS_TEXT[segment.state])}>
          {segmentStatusLabel(m, segment)}
          {segment.note ? ` — ${segment.note}` : ""}
        </span>{" "}
        <span className="text-muted-foreground">
          (
          {sources.length
            ? sources.map((source, i) => (
                <Fragment key={source.name}>
                  {i ? "; " : ""}
                  {`${source.name}, ${formatDate(source.fetchedAt, locale)} · ${m.place.level[source.reliability]}`}
                  {source.stale ? ` · ${m.common.reliability.outdated}` : ""}
                  {source.reliability === "sample" ? <SampleTag className="ml-1 align-middle" /> : null}
                </Fragment>
              ))
            : m.route.nav.unchecked}
          )
        </span>
      </p>
    </li>
  );
}

/** Footer buttons while guiding: step by step without a position, and the way out. */
export function NavigationFooter({ guidance, total, onEnd }: { guidance: Guidance; total: number; onEnd: () => void }) {
  const t = useMessages().route.nav;
  const step = guidance.progress?.step ?? 0;
  return (
    <div className="grid gap-2">
      {guidance.mode !== "located" ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={guidance.previous} disabled={step === 0}>
            <CaretLeft weight="bold" />
            {t.previous}
          </Button>
          <Button variant="outline" onClick={guidance.next} disabled={step >= total - 1}>
            {t.next}
            <CaretRight weight="bold" />
          </Button>
        </div>
      ) : null}
      <Button size="lg" variant="secondary" className="w-full" onClick={onEnd}>
        {t.end}
      </Button>
    </div>
  );
}
