import logging
from typing import List, Dict, Any

logger = logging.getLogger("AutoEdit.PunchZoom")

class RetentionPunchZoom:
    """
    Computes rhythmic camera punch-in and punch-out intervals (1.15x - 1.25x zoom)
    to eliminate viewer fatigue and maintain high short-form retention curves.
    """
    def __init__(self, zoom_factor: float = 1.18, cycle_duration_sec: float = 3.2):
        self.zoom_factor = zoom_factor
        self.cycle_duration_sec = cycle_duration_sec

    def generate_zoom_intervals(self, total_duration: float, beat_times: List[float] = None) -> List[Dict[str, Any]]:
        """
        Generates list of intervals with zoom states (1.0x vs 1.18x).
        """
        intervals = []
        t = 0.0
        is_zoomed = False

        while t < total_duration:
            next_t = min(total_duration, t + self.cycle_duration_sec)
            intervals.append({
                "start": round(t, 2),
                "end": round(next_t, 2),
                "scale": self.zoom_factor if is_zoomed else 1.0,
                "is_zoomed": is_zoomed
            })
            is_zoomed = not is_zoomed
            t = next_t

        return intervals

    def get_ffmpeg_zoom_filter(self, zoom_intervals: List[Dict[str, Any]]) -> str:
        """
        Builds FFmpeg crop/scale filter for instantaneous punch cuts.
        """
        if not zoom_intervals:
            return ""
        
        # Build enable conditions for zoomed intervals
        zoom_conditions = []
        for interval in zoom_intervals:
            if interval.get("is_zoomed", False):
                zoom_conditions.append(f"between(t,{interval['start']},{interval['end']})")
        
        if not zoom_conditions:
            return ""

        expr = "+".join(zoom_conditions)
        return f"crop=w='if({expr},iw/{self.zoom_factor},iw)':h='if({expr},ih/{self.zoom_factor},ih)'"
