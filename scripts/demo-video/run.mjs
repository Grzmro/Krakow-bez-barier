// `npm run demo:video` — the final voiced demo video, end to end (docs/demo-script.md → "Wideo z lektorem"):
//   1. tools: a Python venv with Piper (offline neural TTS) + a static ffmpeg, and the Polish voice pl_PL-gosia-medium
//   2. voice-over: one WAV per scene from apps/web/e2e/demo/narration.json (the scene's length follows from it)
//   3. picture: Playwright records the phone and desktop segments (apps/web/e2e/demo/record-final.ts)
//   4. assemble: mix, subtitles, MP4 — fails above 3:00
// Needs DATABASE_URL (a database with the ingest loaded; use a throwaway one) or E2E_BASE_URL (a running app).
// Flags: --skip-record reuses the recorded segments (after changing only assemble.mjs); --skip-tts reuses the WAVs.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const web = path.join(root, "apps", "web");
const tools = path.resolve(process.env.DEMO_TOOLS_DIR ?? path.join(os.homedir(), ".cache", "kbb-demo-video"));
const out = path.resolve(process.env.DEMO_VIDEO_DIR ?? path.join(web, "demo-output", "video"));
const finalDir = path.resolve(process.env.DEMO_OUT_DIR ?? path.join(web, "demo-output"));
const VOICE = "pl_PL-gosia-medium";
const args = process.argv.slice(2);

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { stdio: "inherit", ...options });
  if (result.status !== 0) throw new Error(`${command} ${commandArgs.slice(0, 3).join(" ")} … failed (${result.status})`);
}
const python = path.join(tools, "venv", "bin", "python");

// 1. Tools (installed once)
fs.mkdirSync(tools, { recursive: true });
if (!fs.existsSync(python)) {
  run("python3", ["-m", "venv", path.join(tools, "venv")]);
  run(python, ["-m", "pip", "install", "--quiet", "piper-tts", "imageio-ffmpeg"]);
}
const voiceFile = path.join(tools, `${VOICE}.onnx`);
if (!fs.existsSync(voiceFile)) run(python, ["-m", "piper.download_voices", "--download-dir", tools, VOICE]);
const ffmpeg = spawnSync(python, ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf8" }).stdout.trim();

// 2. Voice-over
fs.mkdirSync(out, { recursive: true });
if (!args.includes("--skip-tts") && !args.includes("--skip-record")) {
  run(python, [path.join(root, "scripts", "demo-video", "synthesize.py"), path.join(web, "e2e", "demo", "narration.json"), voiceFile, path.join(out, "audio")]);
}

// 3. Picture
if (!args.includes("--skip-record")) {
  run("npm", ["run", "demo:video:record", "-w", "apps/web"], { cwd: root, env: { ...process.env, DEMO_VIDEO_DIR: out } });
}

// 4. Assemble
run("node", [path.join(root, "scripts", "demo-video", "assemble.mjs"), out, ffmpeg, finalDir]);
