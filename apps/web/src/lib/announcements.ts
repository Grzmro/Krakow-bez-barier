import type { Route } from "@krakow-bez-barier/contracts";
import { ARRIVE_METERS, concerns, type Progress } from "./navigation";

/** Closer than this to a manoeuvre or a barrier: it is announced ahead ("Za 50 metrów: …"). */
export const PRE_METERS = 50;
/**
 * A step shorter than the pre-announcement distance plus this names its manoeuvre (and the barrier there) on entry,
 * so two messages never come a few metres apart.
 */
export const QUIET_METERS = 25;

/**
 * What is said, without words: the scheduler picks the moment, `route-speech.ts` the words.
 * - `enter`: the walker is on a new step; `now` when they reached it by walking the previous one (the manoeuvre is
 *   now), `concern` when the step's own barrier or gap goes with it.
 * - `turn`: the manoeuvre that starts step `step` (the destination when `step` is past the last one), `inMeters` away.
 * - `concern`: a barrier, conflict or gap on segment `step`, `inMeters` away.
 */
export type Cue =
  | { kind: "enter"; step: number; now: boolean; concern: boolean }
  | { kind: "turn"; step: number; inMeters: number }
  | { kind: "concern"; step: number; inMeters: number }
  | { kind: "offRoute" }
  | { kind: "arrived" };

/** One utterance: everything due at one position, said together, so a new message never cuts off half of it. */
export type Announcement = { ids: string[]; cues: Cue[] };

/** What has been said on this route: each id once. Off-route episodes are counted, so each new one is said again. */
export type AnnouncerState = { spoken: ReadonlySet<string>; offEpisodes: number; off: boolean };

export const initialAnnouncer: AnnouncerState = { spoken: new Set(), offEpisodes: 0, off: false };

/**
 * The announcement due at `progress` while guiding by GPS, given what was said before; `null` when nothing new is due.
 * Without a position (manual mode, route preview) it never speaks: there, the walker asks for each step.
 *
 * - entering a step: one short message (instruction, then the distance); steps shorter than `ARRIVE_METERS` are passed
 *   in silence, the walker is through them before a message ends;
 * - the manoeuvre at the end of the step and the next barrier or gap: at `PRE_METERS`, or on entry for a short step;
 *   the manoeuvre itself is the next step's entry ("Teraz …"), which `locate` starts `ARRIVE_METERS` before the turn;
 * - a step's own barrier or conflict is repeated on entry ("Na tym odcinku: …"), a gap only if it wasn't said ahead;
 * - off the route and arrival: alone, each once (off the route again after coming back is said again).
 */
export function announce(route: Route, progress: Progress | null, state: AnnouncerState): { state: AnnouncerState; announcement: Announcement | null } {
  if (!progress || progress.offBy === null || !route.segments.length) return { state, announcement: null };
  const spoken = new Set(state.spoken);
  const ids: string[] = [];
  const cues: Cue[] = [];
  const say = (id: string, cue: Cue) => {
    if (spoken.has(id)) return false;
    spoken.add(id);
    ids.push(id);
    cues.push(cue);
    return true;
  };
  const done = (offEpisodes: number, off: boolean) => ({
    state: { spoken, offEpisodes, off },
    announcement: cues.length ? { ids, cues } : null,
  });

  if (progress.offRoute) {
    const offEpisodes = state.off ? state.offEpisodes : state.offEpisodes + 1;
    say(`off:${offEpisodes}`, { kind: "offRoute" });
    return done(offEpisodes, true);
  }
  if (progress.arrived) {
    say("arrived", { kind: "arrived" });
    return done(state.offEpisodes, false);
  }

  const segments = route.segments;
  const step = progress.step;
  const segment = segments[step];
  const enterId = `step:${step}`;
  let entering = false;
  if (!spoken.has(enterId)) {
    if (segment.lengthMeters <= ARRIVE_METERS && step < segments.length - 1) {
      spoken.add(enterId);
      spoken.add(`turn:${step + 1}`);
    } else {
      const now = step > 0 && spoken.has(`step:${step - 1}`);
      const ownSaid = spoken.has(`concern:${step}`);
      const concern = segment.state === "barrier" || segment.state === "conflict" || (segment.state === "unknown" && !ownSaid);
      entering = say(enterId, { kind: "enter", step, now, concern });
      // Said on entry: an "ahead" message about it later would repeat it.
      spoken.add(`concern:${step}`);
    }
  }

  const short = segment.lengthMeters < PRE_METERS + QUIET_METERS;
  const due = (inMeters: number) => inMeters <= PRE_METERS || (entering && short && inMeters < PRE_METERS + QUIET_METERS);
  if (due(progress.toStepEnd)) say(`turn:${step + 1}`, { kind: "turn", step: step + 1, inMeters: progress.toStepEnd });
  const { ahead } = concerns(route, progress);
  if (ahead && due(ahead.inMeters)) say(`concern:${ahead.index}`, { kind: "concern", step: ahead.index, inMeters: ahead.inMeters });

  return done(state.offEpisodes, false);
}

/** A distance rounded for the ear: to 10 m under 200 m, to 50 m under a kilometre, then to 100 m. Never below 10 m. */
export function earMeters(meters: number): number {
  if (meters < 200) return Math.max(10, Math.round(meters / 10) * 10);
  if (meters < 1000) return Math.round(meters / 50) * 50;
  return Math.round(meters / 100) * 100;
}
