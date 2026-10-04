import { Composition } from "remotion";
import { KbbDemo } from "./KbbDemo";
import { timeline } from "./timeline";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="KbbDemo"
      component={KbbDemo}
      durationInFrames={timeline.durationInFrames}
      fps={timeline.fps}
      width={1920}
      height={1080}
    />
  );
};
