// `npm run demo:video` — the final voiced demo video, end to end (docs/demo-script.md → "Wideo z lektorem"):
//   1. tools: a Python venv with edge-tts + a static ffmpeg (imageio-ffmpeg), outside the repo
//   2. voice: one WAV per sentence of video/narration.json (Microsoft neural voice via edge-tts)
//   3. capture: Playwright records the phone and desktop scenes (apps/web/e2e/demo/record-final.ts), each scene as
//      long as its voice; then H.264 copies for Remotion
//   4. timeline + .srt (video/scripts/build-timeline.mjs, fails above 3:00), then the Remotion render (video/)
// Needs DATABASE_URL (a throwaway database with the ingest loaded) or E2E_BASE_URL (a running real-data app).
// Flags: --skip-voice, --skip-capture (reuse what the previous run left in video/public).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const video = path.join(root, "video");
const tools = path.resolve(process.env.DEMO_TOOLS_DIR ?? path.join(os.homedir(), ".cache", "kbb-demo-video"));
const outDir = path.resolve(process.env.DEMO_OUT_DIR ?? path.join(root, "apps", "web", "demo-output"));
const args = process.argv.slice(2);
const MAX_SECONDS = 180;

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { stdio: "inherit", ...options });
  if (result.status !== 0) throw new Error(`${command} ${commandArgs.slice(0, 3).join(" ")} … failed (${result.status})`);
}
const python = path.join(tools, "venv", "bin", "python");

// 1. Tools (installed once)
fs.mkdirSync(tools, { recursive: true });
if (!fs.existsSync(python)) run("python3", ["-m", "venv", path.join(tools, "venv")]);
if (spawnSync(python, ["-c", "import edge_tts, imageio_ffmpeg"]).status !== 0) {
  run(python, ["-m", "pip", "install", "--quiet", "edge-tts", "imageio-ffmpeg"]);
}
const ffmpeg = spawnSync(python, ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf8" }).stdout.trim();
if (!fs.existsSync(path.join(video, "node_modules"))) run("npm", ["ci"], { cwd: video });

// 2. Voice
if (!args.includes("--skip-voice")) {
  run(python, [path.join(video, "scripts", "voice.py"), path.join(video, "narration.json"), path.join(video, "public", "voice"), ffmpeg]);
}

// 3. Capture
if (!args.includes("--skip-capture")) {
  run("npm", ["run", "demo:video:record", "-w", "apps/web"], { cwd: root, env: { ...process.env, DEMO_REMOTION_DIR: video } });
  for (const device of ["phone", "desktop"]) {
    const capture = path.join(video, "public", "capture");
    run(ffmpeg, [
      ...["-hide_banner", "-loglevel", "error", "-y", "-i", path.join(capture, `${device}.webm`)],
      // The phone frame in the video is larger than the 412 px capture: upscale it once, cleanly, here.
      ...(device === "phone" ? ["-vf", "scale=824:1830:flags=lanczos"] : []),
      ...["-c:v", "libx264", "-crf", "16", "-preset", "fast", "-g", "15", "-pix_fmt", "yuv420p", "-r", "30", path.join(capture, `${device}.mp4`)],
    ]);
  }
}

// 4. Timeline, subtitles, render
fs.mkdirSync(outDir, { recursive: true });
const mp4 = path.join(outDir, "kbb-demo-final.mp4");
const srt = path.join(outDir, "kbb-demo-final.srt");
const rendered = path.join(video, "out", "kbb-demo-render.mp4");
run("node", [path.join(video, "scripts", "build-timeline.mjs"), srt]);
run("npx", ["remotion", "render", "KbbDemo", rendered, "--codec=h264", "--audio-codec=aac", "--crf=16"], { cwd: video });
// Final file: limited-range yuv420p (Remotion writes full-range yuvj420p), faststart, Polish subtitle track.
run(ffmpeg, [
  ...["-hide_banner", "-loglevel", "error", "-y", "-i", rendered, "-i", srt, "-map", "0:v", "-map", "0:a", "-map", "1:s"],
  ...["-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-color_range", "tv", "-c:a", "copy", "-c:s", "mov_text"],
  ...["-metadata:s:a:0", "language=pol", "-metadata:s:s:0", "language=pol", "-movflags", "+faststart", mp4],
]);

const probe = spawnSync(ffmpeg, ["-hide_banner", "-i", mp4], { encoding: "utf8" }).stderr;
const [, h, m, s] = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(probe) ?? [];
const seconds = Number(h) * 3600 + Number(m) * 60 + Number(s);
console.log(`${mp4}: ${seconds.toFixed(1)} s${/Audio: aac/.test(probe) ? ", AAC audio" : ", NO AUDIO"}`);
if (!(seconds <= MAX_SECONDS)) throw new Error(`The video is ${seconds.toFixed(1)} s, over the ${MAX_SECONDS} s limit.`);
if (!/Audio: aac/.test(probe)) throw new Error("The video has no AAC audio track.");
