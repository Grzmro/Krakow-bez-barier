import React from "react";
import { AbsoluteFill, Series, useVideoConfig } from "remotion";
import { CloseScene, HookScene, PersonaScene } from "./Cards";
import { DesktopScene, PhoneScene } from "./ScreenScenes";
import { COLORS, timeline } from "./timeline";

// The scene order and lengths come from public/timeline.json (scripts/build-timeline.mjs): card scenes last as long
// as their voice-over, screen scenes as long as their captured span, so picture and voice stay in sync.
export const KbbDemo: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      <Series>
        {timeline.scenes.map((scene) => (
          <Series.Sequence key={scene.id} name={scene.id} durationInFrames={scene.durationInFrames} premountFor={fps}>
            {scene.id === "hook" ? (
              <HookScene scene={scene} />
            ) : scene.id === "persona" ? (
              <PersonaScene scene={scene} />
            ) : scene.id === "close" ? (
              <CloseScene scene={scene} />
            ) : scene.kind === "phone" ? (
              <PhoneScene scene={scene} />
            ) : (
              <DesktopScene scene={scene} />
            )}
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
