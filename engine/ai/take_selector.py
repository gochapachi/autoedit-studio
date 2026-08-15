import re
import logging
from typing import List, Dict, Any

logger = logging.getLogger("AutoEdit.TakeSelector")

FILLER_WORDS = {
    "um", "umm", "uh", "uhh", "aahh", "ahh", "er", "err",
    "like", "you know", "i mean", "sort of", "kind of", "basically", "actually"
}

class FillerAndTakeOptimizer:
    """
    Detects verbal tics, filler words, and stumbled repeated sentences
    in raw speech transcripts to achieve seamless punchy jump-cuts.
    """
    def __init__(self, custom_fillers: List[str] = None):
        self.fillers = set(custom_fillers) if custom_fillers else FILLER_WORDS

    def detect_fillers(self, words: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Scans word list for filler occurrences with exact timestamps.
        """
        detected_fillers = []
        clean_words = []
        time_saved = 0.0

        for w in words:
            clean_token = re.sub(r'[^\w]', '', w.get("word", "").lower())
            if clean_token in self.fillers:
                dur = round(w.get("end", 0.0) - w.get("start", 0.0), 3)
                detected_fillers.append({
                    "word": w.get("word", ""),
                    "start": w.get("start", 0.0),
                    "end": w.get("end", 0.0),
                    "duration": dur
                })
                time_saved += dur
            else:
                clean_words.append(w)

        return {
            "fillers_count": len(detected_fillers),
            "fillers": detected_fillers,
            "time_saved_sec": round(time_saved, 2),
            "clean_words": clean_words
        }

    def detect_repeated_stumbles(self, segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Identifies false starts (e.g. 'We decided to... We decided to scale the product').
        Keeps the final complete take and flags the earlier stumble for removal.
        """
        optimized_segments = []
        
        for i in range(len(segments)):
            current = segments[i]
            # Check if next segment starts with almost the exact same first 3 words
            is_stumble = False
            if i < len(segments) - 1:
                next_seg = segments[i+1]
                curr_words = current.get("text", "").lower().split()[:4]
                next_words = next_seg.get("text", "").lower().split()[:4]
                
                if len(curr_words) >= 2 and len(next_words) >= 2:
                    if curr_words[:2] == next_words[:2] and len(current.get("text", "")) < len(next_seg.get("text", "")):
                        is_stumble = True

            optimized_segments.append({
                "segment": current,
                "is_stumble": is_stumble,
                "action": "cut" if is_stumble else "keep"
            })

        return optimized_segments
