"""Voice-over for the demo video: one WAV per sentence with edge-tts (Microsoft neural voice), durations measured.

Usage: voice.py <narration.json> <out-dir> <ffmpeg>   (env: VOICE, default pl-PL-MarekNeural; RATE, default -3%)
Writes <out-dir>/<scene>-<n>.wav and <out-dir>/voice.json:
  {scene: {"sentences": [{"file", "text", "start", "duration"}], "total": seconds}}
where "start" is the sentence's offset inside its scene (a short lead-in, then a pause between sentences).
"""

import asyncio
import json
import os
import re
import subprocess
import sys
from pathlib import Path

import edge_tts

narration_file, out_dir, ffmpeg = sys.argv[1:4]
VOICE = os.environ.get("VOICE", "pl-PL-MarekNeural")
RATE = os.environ.get("RATE", "+0%")
LEAD = 0.25
GAP = 0.3
TAIL = 0.4

out = Path(out_dir)
out.mkdir(parents=True, exist_ok=True)


def duration(file: Path) -> float:
    probe = subprocess.run([ffmpeg, "-hide_banner", "-i", str(file)], capture_output=True, text=True).stderr
    h, m, s = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", probe).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


async def main():
    scenes = json.loads(Path(narration_file).read_text(encoding="utf-8"))
    result = {}
    for scene in scenes:
        at = LEAD
        sentences = []
        for n, text in enumerate(scene["sentences"], start=1):
            raw = out / f"{scene['id']}-{n}.raw.mp3"
            target = out / f"{scene['id']}-{n}.wav"
            await edge_tts.Communicate(text, VOICE, rate=RATE).save(str(raw))
            # The pauses are ours (LEAD, GAP, TAIL): trim the silence the service leaves around each sentence.
            trim = "silenceremove=start_periods=1:start_threshold=-50dB"
            subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(raw), "-af", f"{trim},areverse,{trim},areverse", "-ar", "44100", str(target)], check=True)
            raw.unlink()
            length = duration(target)
            sentences.append({"file": target.name, "text": text, "start": round(at, 3), "duration": round(length, 3)})
            at += length + GAP
        result[scene["id"]] = {"sentences": sentences, "total": round(at - GAP + TAIL, 3)}
        print(f"{scene['id']}: {result[scene['id']]['total']} s")
    (out / "voice.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"total: {sum(s['total'] for s in result.values()):.1f} s ({VOICE}, rate {RATE})")


asyncio.run(main())
