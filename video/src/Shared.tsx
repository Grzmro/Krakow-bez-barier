import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { COLORS, FONT, type Scene, type Tap } from "./timeline";

/** The brand backdrop: deep violet with a slowly drifting glow. */
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, 900], [22, 34], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill
      style={{ background: `radial-gradient(circle at ${x}% 30%, #3b2a7a 0%, ${COLORS.deep} 42%, ${COLORS.ink} 78%)` }}
    />
  );
};

/** Fades a whole scene in and out over a few frames, so cuts feel soft. */
export const SceneFade: React.FC<{ durationInFrames: number; children: React.ReactNode }> = ({ durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8, durationInFrames - 8, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

/** Every sentence of the scene's voice-over at its own offset. */
export const Voice: React.FC<{ scene: Scene }> = ({ scene }) => {
  return (
    <>
      {scene.sentences.map((s) => (
        <Sequence key={s.file} name={`Głos: ${s.file}`} from={s.from} durationInFrames={s.durationInFrames + 2} layout="none">
          <Audio src={staticFile(`voice/${s.file}`)} />
        </Sequence>
      ))}
    </>
  );
};

/** The sentence being spoken, popping in phrase by phrase (kinetic caption). */
export const Caption: React.FC<{ scene: Scene; size: number; align?: "left" | "center"; maxWidth: number }> = ({
  scene,
  size,
  align = "left",
  maxWidth,
}) => {
  const frame = useCurrentFrame();
  const current = [...scene.sentences].reverse().find((s) => frame >= s.from - 4);
  if (!current) return null;
  const local = frame - current.from;
  const words = current.text.split(" ");
  const perWord = Math.max(2, current.durationInFrames / words.length);
  return (
    <div
      key={current.file}
      style={{
        fontFamily: FONT,
        fontSize: size,
        fontWeight: 700,
        lineHeight: 1.22,
        color: COLORS.white,
        maxWidth,
        textAlign: align,
        letterSpacing: "-0.01em",
      }}
    >
      {words.map((word, i) => {
        const appear = interpolate(local, [i * perWord * 0.55 - 4, i * perWord * 0.55 + 4], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        });
        return (
          <span
            key={i}
            style={{ display: "inline-block", opacity: 0.25 + 0.75 * appear, translate: `0px ${(1 - appear) * 14}px`, marginRight: "0.28em" }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

/** A small uppercase label above captions and cards. */
export const Kicker: React.FC<{ children: React.ReactNode; size?: number }> = ({ children, size = 26 }) => (
  <div style={{ fontFamily: FONT, fontSize: size, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: COLORS.lilac }}>
    {children}
  </div>
);

/**
 * Zoom for screen captures, driven by the logged taps: eases in shortly before each tap, holds, eases out. Returns the
 * scale and the point (in capture coordinates) the zoom centres on.
 */
export function useTapZoom(taps: Tap[], strength: number) {
  const frame = useCurrentFrame();
  let best = { amount: 0, tap: taps[0] as Tap | undefined };
  for (const tap of taps) {
    const amount = interpolate(frame, [tap.frame - 14, tap.frame + 2, tap.frame + 40, tap.frame + 62], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.45, 0, 0.2, 1),
    });
    if (amount > best.amount) best = { amount, tap };
  }
  return { scale: 1 + (strength - 1) * best.amount, focus: best.tap, amount: best.amount };
}

/** A soft tap ripple at each logged tap, in capture coordinates (place inside the capture's own box). */
export const TapRipples: React.FC<{ taps: Tap[]; radius: number }> = ({ taps, radius }) => {
  const frame = useCurrentFrame();
  return (
    <>
      {taps.map((tap) => {
        const t = frame - tap.frame;
        if (t < -2 || t > 22) return null;
        const grow = interpolate(t, [-2, 22], [0.4, 1.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const fade = interpolate(t, [-2, 4, 22], [0, 0.9, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div
            key={tap.frame}
            style={{
              position: "absolute",
              left: tap.x - radius,
              top: tap.y - radius,
              width: radius * 2,
              height: radius * 2,
              borderRadius: "50%",
              background: "rgba(124,58,237,.28)",
              border: "3px solid rgba(124,58,237,.9)",
              scale: String(grow),
              opacity: fade,
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
};
