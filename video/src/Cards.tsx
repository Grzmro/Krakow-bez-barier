import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Backdrop, Caption, Kicker, SceneFade, Voice } from "./Shared";
import { COLORS, FONT, type Scene } from "./timeline";

const rise = (frame: number, start: number) =>
  interpolate(frame, [start, start + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });

/** A number that counts up, Polish thousands separator. */
const Counter: React.FC<{ value: number; start: number }> = ({ value, start }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [start, start + 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
  return <>{Math.round(value * progress).toLocaleString("pl-PL").replace(/\u00a0/g, " ")}</>;
};

const Stat: React.FC<{ value: number; label: string; note: string; start: number }> = ({ value, label, note, start }) => {
  const frame = useCurrentFrame();
  const t = rise(frame, start);
  return (
    <div style={{ opacity: t, translate: `0px ${(1 - t) * 30}px`, flex: 1 }}>
      <div style={{ fontFamily: FONT, fontSize: 150, fontWeight: 800, color: COLORS.white, letterSpacing: "-0.03em", lineHeight: 1 }}>
        <Counter value={value} start={start} />
      </div>
      <div style={{ fontFamily: FONT, fontSize: 40, fontWeight: 600, color: COLORS.white, marginTop: 18 }}>{label}</div>
      <div style={{ fontFamily: FONT, fontSize: 24, color: COLORS.muted, marginTop: 8 }}>{note}</div>
    </div>
  );
};

/** Hook: the two GUS figures already shown in the app's city panel (KBB-134), with their source. */
export const HookScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const third = scene.sentences[2];
  return (
    <SceneFade durationInFrames={scene.durationInFrames}>
      <Backdrop />
      <AbsoluteFill style={{ padding: "150px 140px", gap: 70 }}>
        <Kicker>Kraków w liczbach GUS</Kicker>
        <div style={{ display: "flex", gap: 100 }}>
          <Stat value={111014} label="osób z niepełnosprawnością" note="Narodowy Spis Powszechny 2021" start={scene.sentences[0].from} />
          <Stat value={183315} label="osób w wieku poprodukcyjnym" note="stan na 2025 rok" start={scene.sentences[1].from} />
        </div>
        <div style={{ opacity: rise(frame, third.from), fontFamily: FONT, fontSize: 56, fontWeight: 700, color: COLORS.lilac, maxWidth: 1500 }}>
          Jeden schodek przy wejściu potrafi przekreślić cały wieczór.
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 140, bottom: 70, fontFamily: FONT, fontSize: 22, color: COLORS.muted }}>
        Źródło: GUS, Bank Danych Lokalnych (bdl.stat.gov.pl), licencja CC BY 4.0
      </div>
      <Voice scene={scene} />
    </SceneFade>
  );
};

/** The persona and her goal for the day. */
export const PersonaScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const plan = rise(frame, scene.sentences[1].from);
  return (
    <SceneFade durationInFrames={scene.durationInFrames}>
      <Backdrop />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 160px", gap: 110 }}>
        <div
          style={{
            opacity: rise(frame, 0),
            width: 360,
            height: 360,
            borderRadius: "50%",
            background: `linear-gradient(140deg, ${COLORS.violet}, #4c1d95)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONT,
            fontSize: 190,
            fontWeight: 800,
            color: COLORS.white,
            boxShadow: "0 30px 80px rgba(0,0,0,.45)",
          }}
        >
          A
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
          <Kicker>Persona</Kicker>
          <div style={{ fontFamily: FONT, fontSize: 120, fontWeight: 800, color: COLORS.white, letterSpacing: "-0.02em", opacity: rise(frame, 4) }}>
            Anna, jeździ na wózku
          </div>
          <div style={{ display: "flex", gap: 24, opacity: plan, translate: `0px ${(1 - plan) * 24}px` }}>
            {["Kolacja w restauracji", "Potem muzeum"].map((item) => (
              <div key={item} style={{ padding: "18px 34px", borderRadius: 999, background: "rgba(196,181,253,.16)", border: "2px solid rgba(196,181,253,.5)", fontFamily: FONT, fontSize: 40, fontWeight: 600, color: COLORS.white }}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </AbsoluteFill>
      <Voice scene={scene} />
    </SceneFade>
  );
};

/** Closing card: the name and the one-line promise. */
export const CloseScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  return (
    <SceneFade durationInFrames={scene.durationInFrames + 8}>
      <Backdrop />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40 }}>
        <div style={{ opacity: rise(frame, 0), fontFamily: FONT, fontSize: 130, fontWeight: 800, color: COLORS.white, letterSpacing: "-0.02em" }}>
          Kraków bez barier
        </div>
        <div style={{ opacity: rise(frame, scene.sentences[1].from) }}>
          <Caption scene={{ ...scene, sentences: scene.sentences.slice(1) }} size={56} align="center" maxWidth={1500} />
        </div>
        <div style={{ opacity: rise(frame, scene.sentences[1].from + 10), fontFamily: FONT, fontSize: 26, color: COLORS.muted }}>
          Źródło przy każdej informacji · otwarte API · HackYeah 2026
        </div>
      </AbsoluteFill>
      <Voice scene={scene} />
    </SceneFade>
  );
};
