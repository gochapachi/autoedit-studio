import os
import logging
from typing import List, Dict, Any

logger = logging.getLogger("AutoEdit.BeatDetector")

class BeatDetector:
    """
    Analyzes background music to extract BPM, beat timestamps, and drops/energy peaks
    to automatically snap video cuts, zoom punch-ins, and text bounce animations.
    """
    def __init__(self):
        pass

    def analyze_beats(self, audio_path: str) -> Dict[str, Any]:
        """
        Computes tempo, beat timestamps, and energy onset peaks.
        """
        if not os.path.exists(audio_path):
            return {
                "tempo": 120.0,
                "beat_times": [round(i * 0.5, 2) for i in range(20)],
                "drops": [0.0, 10.0]
            }

        try:
            import librosa
            import numpy as np

            # Load first 60 seconds of audio
            y, sr = librosa.load(audio_path, sr=22050, duration=60.0)
            
            # Estimate tempo and beat frames
            tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
            beat_times = librosa.frames_to_time(beat_frames, sr=sr)

            # Detect onset energy strength
            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            onset_times = librosa.times_like(onset_env, sr=sr)
            
            # Find top energy drops / peaks
            top_peaks_idx = np.argsort(onset_env)[-5:]
            drops = sorted([round(float(onset_times[idx]), 2) for idx in top_peaks_idx])

            tempo_val = float(tempo[0]) if isinstance(tempo, np.ndarray) else float(tempo)

            return {
                "tempo": round(tempo_val, 1),
                "beat_times": [round(float(bt), 2) for bt in beat_times],
                "drops": drops
            }

        except Exception as e:
            logger.error(f"Beat detection error: {e}")
            return {
                "tempo": 120.0,
                "beat_times": [round(i * 0.5, 2) for i in range(20)],
                "drops": [0.0, 10.0]
            }
