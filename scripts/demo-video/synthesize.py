"""Synthesizes the voice-over of the final demo video, one WAV per scene, with Piper (offline neural TTS).

Usage: synthesize.py <narration.json> <voice.onnx> <out-dir>
Writes <out-dir>/<scene id>.wav and <out-dir>/durations.json ({scene id: seconds}).
"""

import json
import sys
import wave
from pathlib import Path

from piper import PiperVoice, SynthesisConfig

narration_file, voice_file, out_dir = sys.argv[1:4]
out = Path(out_dir)
out.mkdir(parents=True, exist_ok=True)

voice = PiperVoice.load(voice_file)
# A little slower than the default: the voice is read over a busy screen.
config = SynthesisConfig(length_scale=1.08, noise_scale=0.55, noise_w_scale=0.7)

durations = {}
for scene in json.loads(Path(narration_file).read_text(encoding="utf-8")):
    target = out / f"{scene['id']}.wav"
    with wave.open(str(target), "wb") as wav:
        voice.synthesize_wav(scene.get("speak", scene["text"]), wav, syn_config=config)
    with wave.open(str(target), "rb") as wav:
        durations[scene["id"]] = round(wav.getnframes() / wav.getframerate(), 3)
    print(f"{scene['id']}: {durations[scene['id']]} s")

(out / "durations.json").write_text(json.dumps(durations, indent=2) + "\n", encoding="utf-8")
