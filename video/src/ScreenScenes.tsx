import { Video } from "@remotion/media";
import React from "react";
import { Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, Caption, Kicker, SceneFade, TapRipples, useTapZoom, Voice } from "./Shared";
import { FONT, type Scene, type Tap } from "./timeline";

const PHONE = { width: 412, height: 915 };
const DESKTOP = { width: 1600, height: 900 };

export const TITLES: Record<string, string> = {
  start: "Start",
  search: "Szukanie",
  toilet: "Najbliższa toaleta",
  card: "Skąd to wiemy",
  report: "Poprawki od mieszkańców",
  museum: "Deklaracja dostępności",
  share: "Udostępnianie",
  route: "Trasa dla wózka",
  go: "Prowadzenie",
  trust: "Źródła i jakość",
  business: "Dla firm",
  keyboard: "Dostępność",
};

/** The phone capture in a phone frame on the left, the caption on the right; zooms the phone toward each tap. */
export const PhoneScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const { fps } = useVideoConfig();
  const scale = 1.04;
  const { scale: zoom, focus } = useTapZoom(scene.taps, 1.22);
  const originX = focus ? focus.x * scale + 14 : PHONE.width / 2;
  const originY = focus ? focus.y * scale + 14 : PHONE.height / 2;
  return (
    <SceneFade durationInFrames={scene.durationInFrames}>
      <Backdrop />
      <div style={{ position: "absolute", left: 200, top: (1080 - PHONE.height * scale - 28) / 2 }}>
        <div style={{ scale: String(zoom), transformOrigin: `${originX}px ${originY}px` }}>
          <div
            style={{
              width: PHONE.width * scale + 28,
              height: PHONE.height * scale + 28,
              padding: 14,
              borderRadius: 60,
              background: "#0b0b10",
              boxShadow: "0 40px 90px rgba(0,0,0,.55), inset 0 0 0 2px #2a2a35",
            }}
          >
            <div style={{ position: "relative", width: PHONE.width * scale, height: PHONE.height * scale, borderRadius: 46, overflow: "hidden", background: "#fff" }}>
              <div style={{ position: "absolute", left: 0, top: 0, width: PHONE.width, height: PHONE.height, scale: String(scale), transformOrigin: "0 0" }}>
                {/* The phone capture is recorded at twice the CSS size (deviceScaleFactor 2), so it stays sharp here. */}
                <div style={{ width: PHONE.width * 2, height: PHONE.height * 2, scale: "0.5", transformOrigin: "0 0", position: "absolute" }}>
                  <Video src={staticFile("capture/phone.mp4")} trimBefore={scene.trimBefore} muted premountFor={fps} style={{ width: PHONE.width * 2, height: PHONE.height * 2 }} />
                </div>
                <TapRipples taps={scene.taps} radius={26} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 780, right: 120, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 28 }}>
        <Kicker>{TITLES[scene.id]}</Kicker>
        <Caption scene={scene} size={60} maxWidth={1000} />
      </div>
      <Voice scene={scene} />
    </SceneFade>
  );
};

/** A cursor that glides to each tap before it happens (desktop captures have no pointer of their own). */
const Cursor: React.FC<{ taps: Tap[] }> = ({ taps }) => {
  const frame = useCurrentFrame();
  if (!taps.length) return null;
  const next = taps.findIndex((t) => t.frame >= frame - 30);
  const target = taps[next === -1 ? taps.length - 1 : next];
  const previous = next > 0 ? taps[next - 1] : { x: target.x + 160, y: target.y + 120, frame: target.frame - 40 };
  const move = interpolate(frame, [target.frame - 22, target.frame - 2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.2, 1),
  });
  const x = previous.x + (target.x - previous.x) * move;
  const y = previous.y + (target.y - previous.y) * move;
  const press = interpolate(frame - target.frame, [-3, 0, 5], [1, 0.82, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <svg width={34} height={40} viewBox="0 0 17 20" style={{ position: "absolute", left: x - 4, top: y - 2, scale: String(press), transformOrigin: "4px 2px" }}>
      <path d="M1 1 L1 16 L5 12.5 L8 19 L10.6 18 L7.7 11.6 L13 11.6 Z" fill="#111" stroke="#fff" strokeWidth={1.3} strokeLinejoin="round" />
    </svg>
  );
};

/** The desktop capture in a clean browser window, caption below; zooms toward each click. */
export const DesktopScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const { fps } = useVideoConfig();
  const scale = 0.975;
  const width = DESKTOP.width * scale;
  const height = DESKTOP.height * scale;
  const { scale: zoom, focus } = useTapZoom(scene.taps, 1.35);
  const originX = focus ? focus.x : DESKTOP.width / 2;
  const originY = focus ? focus.y : DESKTOP.height / 2;
  return (
    <SceneFade durationInFrames={scene.durationInFrames}>
      <Backdrop />
      <div style={{ position: "absolute", left: (1920 - width) / 2, top: 26 }}>
        <div style={{ width, borderRadius: 18, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,.5)", background: "#fff" }}>
          <div style={{ height: 38, background: "#ece9f5", display: "flex", alignItems: "center", gap: 9, padding: "0 16px" }}>
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
              <div key={c} style={{ width: 13, height: 13, borderRadius: "50%", background: c }} />
            ))}
            <div style={{ marginLeft: 22, padding: "5px 18px", borderRadius: 999, background: "#fff", fontFamily: FONT, fontSize: 16, color: "#4b4470" }}>
              Kraków bez barier
            </div>
          </div>
          <div style={{ position: "relative", width, height, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 0, top: 0, width: DESKTOP.width, height: DESKTOP.height, scale: String(scale), transformOrigin: "0 0" }}>
              <div style={{ width: DESKTOP.width, height: DESKTOP.height, scale: String(zoom), transformOrigin: `${originX}px ${originY}px`, position: "relative" }}>
                <Video src={staticFile("capture/desktop.mp4")} trimBefore={scene.trimBefore} muted premountFor={fps} style={{ width: DESKTOP.width, height: DESKTOP.height }} />
                <TapRipples taps={scene.taps} radius={22} />
                <Cursor taps={scene.taps} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 26 + 38 + height + 8, bottom: 0, left: 90, right: 90, display: "flex", flexDirection: "row", alignItems: "center", gap: 36 }}>
        <div style={{ flex: "0 0 300px" }}>
          <Kicker size={22}>{TITLES[scene.id]}</Kicker>
        </div>
        <Caption scene={scene} size={36} maxWidth={1400} />
      </div>
      <Voice scene={scene} />
    </SceneFade>
  );
};

