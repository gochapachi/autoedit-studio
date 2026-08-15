import os
import math
import wave
import struct
import logging
from typing import Dict, Any, List

logger = logging.getLogger("AutoEdit.SFXDucking")

class SFXAndDuckingSuite:
    """
    Handles automatic vocal sidechain ducking (ducking BGM under speech to -18dB)
    and generates/places crisp viral sound effects (whooshes, pops, dings, risers).
    """
    def __init__(self, sfx_dir: str = None):
        self.sfx_dir = sfx_dir or os.path.join(os.getcwd(), "sfx_library")
        os.makedirs(self.sfx_dir, exist_ok=True)
        self._ensure_built_in_sfx()

    def _ensure_built_in_sfx(self):
        """Generates crisp synthetic sound effect wav files if not present."""
        sfx_files = {
            "pop.wav": self._create_pop_sound,
            "whoosh.wav": self._create_whoosh_sound,
            "ding.wav": self._create_ding_sound,
            "riser.wav": self._create_riser_sound,
            "camera_shutter.wav": self._create_shutter_sound
        }

        for filename, generator in sfx_files.items():
            path = os.path.join(self.sfx_dir, filename)
            if not os.path.exists(path):
                try:
                    generator(path)
                except Exception as e:
                    logger.error(f"Failed to generate {filename}: {e}")

    def _create_pop_sound(self, path: str):
        """Creates a cheerful, short UI pop sound (0.12s)."""
        sr = 44100
        dur = 0.12
        frames = int(sr * dur)
        with wave.open(path, 'w') as wav:
            wav.setparams((1, 2, sr, frames, 'NONE', 'not compressed'))
            for i in range(frames):
                t = i / sr
                # Frequency sweeps from 400Hz to 850Hz with fast exponential decay
                freq = 400 + 450 * (i / frames)
                decay = math.exp(-t * 35)
                val = int(32767.0 * 0.8 * math.sin(2 * math.pi * freq * t) * decay)
                wav.writeframes(struct.pack('<h', max(-32767, min(32767, val))))

    def _create_whoosh_sound(self, path: str):
        """Creates a smooth cinematic whoosh transition sound (0.35s)."""
        import random
        sr = 44100
        dur = 0.35
        frames = int(sr * dur)
        with wave.open(path, 'w') as wav:
            wav.setparams((1, 2, sr, frames, 'NONE', 'not compressed'))
            for i in range(frames):
                t = i / dur
                envelope = math.sin(math.pi * t) ** 2 # smooth rise and fall
                noise = (random.random() * 2 - 1)
                sine = math.sin(2 * math.pi * (180 + 350 * t) * (i / sr))
                val = int(32767.0 * 0.7 * (0.6 * noise + 0.4 * sine) * envelope)
                wav.writeframes(struct.pack('<h', max(-32767, min(32767, val))))

    def _create_ding_sound(self, path: str):
        """Creates a sparkling high bell chime ding (0.4s)."""
        sr = 44100
        dur = 0.4
        frames = int(sr * dur)
        with wave.open(path, 'w') as wav:
            wav.setparams((1, 2, sr, frames, 'NONE', 'not compressed'))
            for i in range(frames):
                t = i / sr
                decay = math.exp(-t * 8)
                val = int(32767.0 * 0.7 * (math.sin(2 * math.pi * 1760 * t) + 0.4 * math.sin(2 * math.pi * 3520 * t)) * decay)
                wav.writeframes(struct.pack('<h', max(-32767, min(32767, val))))

    def _create_riser_sound(self, path: str):
        """Creates a 1.5s tension riser for video hooks."""
        sr = 44100
        dur = 1.5
        frames = int(sr * dur)
        with wave.open(path, 'w') as wav:
            wav.setparams((1, 2, sr, frames, 'NONE', 'not compressed'))
            for i in range(frames):
                t = i / dur
                freq = 150 + 700 * (t ** 2) # exponential pitch rise
                amp = 0.1 + 0.8 * (t ** 1.5)
                val = int(32767.0 * amp * math.sin(2 * math.pi * freq * (i / sr)))
                wav.writeframes(struct.pack('<h', max(-32767, min(32767, val))))

    def _create_shutter_sound(self, path: str):
        """Creates a mechanical camera shutter click (0.15s)."""
        import random
        sr = 44100
        dur = 0.15
        frames = int(sr * dur)
        with wave.open(path, 'w') as wav:
            wav.setparams((1, 2, sr, frames, 'NONE', 'not compressed'))
            for i in range(frames):
                t = i / sr
                decay = math.exp(-t * 40)
                noise = (random.random() * 2 - 1)
                val = int(32767.0 * 0.9 * noise * decay)
                wav.writeframes(struct.pack('<h', max(-32767, min(32767, val))))

    def get_sidechain_ducking_filter(self, bgm_volume_db: float = -18.0) -> str:
        """
        Returns FFmpeg sidechaincompress filter configuration.
        Ducks input 1 (BGM) whenever input 0 (Vocal dialogue) is speaking.
        """
        return f"sidechaincompress=threshold=0.08:ratio=6:attack=25:release=350:makeup=0"
