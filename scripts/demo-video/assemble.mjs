// Assembles the final demo video from what `record-final.ts` and `synthesize.py` wrote into <dir>:
//   segments/phone.webm + segments/desktop.webm, timeline.json, audio/<scene>.wav
// → kbb-demo-final.mp4 (H.264 yuv420p + AAC, 1920×1080, faststart, Polish subtitle track) and kbb-demo-final.srt.
// Usage: node assemble.mjs <dir> <ffmpeg> [output-dir]   Fails when the video is longer than 3:00.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [dirArg, ffmpeg, outArg] = process.argv.slice(2);
if (!dirArg || !ffmpeg) throw new Error("Usage: node assemble.mjs <dir> <ffmpeg> [output-dir]");
const dir = path.resolve(dirArg);
const outDir = path.resolve(outArg ?? path.dirname(dir));
const MAX_SECONDS = 180;
const TAIL = 0.8;
const SEGMENTS = ["phone", "desktop"];

function run(args, { capture = false } = {}) {
  const result = spawnSync(ffmpeg, ["-hide_banner", "-y", ...args], { encoding: "utf8", stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"] });
  if (!capture && result.status !== 0) throw new Error(`ffmpeg failed: ${args.join(" ")}`);
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function duration(file) {
  const match = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(run(["-i", file], { capture: true }));
  if (!match) throw new Error(`No duration for ${file}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

const timeline = JSON.parse(fs.readFileSync(path.join(dir, "timeline.json"), "utf8"));
const work = path.join(dir, "work");
fs.mkdirSync(work, { recursive: true });

// 1. Each segment as H.264 with one frame rate and size, so the pieces join without re-encoding.
const lengths = {};
for (const segment of SEGMENTS) {
  const target = path.join(work, `${segment}.mp4`);
  run([
    ...["-i", path.join(dir, "segments", `${segment}.webm`)],
    ...["-vf", "fps=30,scale=1920:1080,format=yuv420p", "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-an", target],
  ]);
  lengths[segment] = duration(target);
}
const offsets = { phone: 0, desktop: lengths.phone };

fs.writeFileSync(path.join(work, "list.txt"), SEGMENTS.map((s) => `file '${path.join(work, `${s}.mp4`)}'`).join("\n"));
const picture = path.join(work, "picture.mp4");
run(["-f", "concat", "-safe", "0", "-i", path.join(work, "list.txt"), "-c", "copy", picture]);

// 2. The voice-over: every scene's WAV delayed to its start in the joined video.
const scenes = timeline.map((t) => ({ ...t, at: t.start + offsets[t.segment] }));
const lastEnd = Math.max(...scenes.map((s) => s.at + s.audio));
const total = Math.min(duration(picture), lastEnd + TAIL);
const inputs = scenes.flatMap((s) => ["-i", path.join(dir, "audio", `${s.id}.wav`)]);
const delays = scenes.map((s, i) => `[${i}:a]aresample=44100,adelay=${Math.round(s.at * 1000)}:all=1[a${i}]`);
const mix = `${scenes.map((_, i) => `[a${i}]`).join("")}amix=inputs=${scenes.length}:normalize=0:dropout_transition=0,alimiter=limit=0.95[voice]`;
const voice = path.join(work, "voice.m4a");
run([...inputs, "-filter_complex", [...delays, mix].join(";"), "-map", "[voice]", "-t", String(total), "-c:a", "aac", "-b:a", "192k", voice]);

// 3. Subtitles: the scene text, wrapped, split in two cues when long, timed to the voice.
const srtTime = (seconds) => {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
};
function wrap(text, width) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && `${line} ${word}`.length > width) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}
const cues = [];
for (const s of scenes) {
  const sentences = s.text.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g) ?? [s.text];
  const chunks = [];
  let current = "";
  for (const sentence of sentences.map((x) => x.trim())) {
    if (current && `${current} ${sentence}`.length > 84) {
      chunks.push(current);
      current = sentence;
    } else current = current ? `${current} ${sentence}` : sentence;
  }
  if (current) chunks.push(current);
  const characters = chunks.reduce((sum, c) => sum + c.length, 0);
  let at = s.at;
  for (const chunk of chunks) {
    const length = (s.audio * chunk.length) / characters;
    cues.push({ from: at, to: at + length, text: wrap(chunk, 42).join("\n") });
    at += length;
  }
}
const srt = cues.map((c, i) => `${i + 1}\n${srtTime(c.from)} --> ${srtTime(c.to)}\n${c.text}\n`).join("\n");
fs.mkdirSync(outDir, { recursive: true });
const srtFile = path.join(outDir, "kbb-demo-final.srt");
fs.writeFileSync(srtFile, srt);

// 4. Mux.
const mp4 = path.join(outDir, "kbb-demo-final.mp4");
run([
  ...["-i", picture, "-i", voice, "-i", srtFile],
  ...["-map", "0:v", "-map", "1:a", "-map", "2:s", "-c:v", "copy", "-c:a", "copy", "-c:s", "mov_text"],
  ...["-metadata:s:s:0", "language=pol", "-metadata:s:a:0", "language=pol", "-t", String(total), "-movflags", "+faststart", mp4],
]);

const finalLength = duration(mp4);
fs.writeFileSync(
  path.join(outDir, "kbb-demo-final-scenes.json"),
  `${JSON.stringify(scenes.map((s) => ({ id: s.id, title: s.title, start: Number(s.at.toFixed(2)), voice: Number(s.audio.toFixed(2)) })), null, 2)}\n`,
);
console.log(`${mp4}: ${finalLength.toFixed(1)} s`);
if (finalLength > MAX_SECONDS) throw new Error(`The video is ${finalLength.toFixed(1)} s, over the ${MAX_SECONDS} s limit.`);
