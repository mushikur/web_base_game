"""Offline authoring helper. Piper 1.8 Python API; no game runtime dependency."""
import json
import sys
import wave
from piper import PiperVoice, SynthesisConfig

sys.stdout.reconfigure(encoding="utf-8")
voice = PiperVoice.load(sys.argv[1])
tasks = json.load(sys.stdin)
for i, task in enumerate(tasks):
    config = SynthesisConfig(speaker_id=task["speaker"], length_scale=1.08, volume=0.85)
    with wave.open(task["file"], "wb") as output:
        voice.synthesize_wav(task["text"], output, syn_config=config)
    print(f"বাংলা কণ্ঠ {i + 1}/{len(tasks)}: {task['text']}", flush=True)
