// Builds public/timeline.json (what the Remotion composition plays) and the .srt from one source:
// narration.json (scenes, sentences), public/voice/voice.json (sentence lengths) and public/capture/capture.json (where
// each scene sits in the raw captures, and the taps). Card scenes last as long as their voice; screen scenes as long as
// their captured span, which the recorder made at least as long as the voice. Fails above 3:00.
// Usage: node scripts/build-timeline.mjs [srt-path]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FPS = 30;
const MAX_SECONDS = 180;
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

const narration = read("narration.json");
const voice = read("public/voice/voice.json");
const capture = read("public/capture/capture.json");

let from = 0;
const scenes = narration.map((scene) => {
  const span = capture.find((s) => s.id === scene.id);
  if (scene.kind !== "card" && !span) throw new Error(`No capture for scene ${scene.id}; run the capture first.`);
  const seconds = span ? span.end - span.start : voice[scene.id].total;
  const durationInFrames = Math.ceil(seconds * FPS);
  const entry = {
    id: scene.id,
    kind: scene.kind,
    from,
    durationInFrames,
    trimBefore: span ? Math.round(span.start * FPS) : 0,
    taps: (span?.taps ?? []).map((t) => ({ frame: Math.round(t.t * FPS), x: t.x, y: t.y })),
    sentences: voice[scene.id].sentences.map((s) => ({
      file: s.file,
      text: s.text,
      from: Math.round(s.start * FPS),
      durationInFrames: Math.ceil(s.duration * FPS),
    })),
  };
  from += durationInFrames;
  return entry;
});

const timeline = { fps: FPS, durationInFrames: from, scenes };
fs.writeFileSync(path.join(root, "public", "timeline.json"), `${JSON.stringify(timeline, null, 2)}\n`);

const srtTime = (frames) => {
  const ms = Math.round((frames / FPS) * 1000);
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
};
const wrap = (text, width = 42) =>
  text.split(" ").reduce((lines, word) => {
    const last = lines[lines.length - 1];
    if (last && `${last} ${word}`.length <= width) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
    return lines;
  }, []);
const cues = scenes.flatMap((scene) =>
  scene.sentences.map((s) => ({ start: scene.from + s.from, end: scene.from + s.from + s.durationInFrames, text: wrap(s.text).join("\n") })),
);
const srt = cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join("\n");
const srtPath = process.argv[2] ?? path.join(root, "out", "kbb-demo-final.srt");
fs.mkdirSync(path.dirname(srtPath), { recursive: true });
fs.writeFileSync(srtPath, srt);

for (const s of scenes) console.log(`${(s.from / FPS).toFixed(1).padStart(6)} s  ${s.id} (${(s.durationInFrames / FPS).toFixed(1)} s)`);
console.log(`total ${(from / FPS).toFixed(1)} s`);
if (from / FPS > MAX_SECONDS) throw new Error(`The video would be ${(from / FPS).toFixed(1)} s, over the ${MAX_SECONDS} s limit.`);
