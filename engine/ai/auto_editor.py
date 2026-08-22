import os
import re
import json
import logging
from collections import Counter
from typing import Dict, Any, List, Optional

logger = logging.getLogger("AutoEdit.AutoEditor")

try:
    from ai.local_ai import LocalAIEngine, DEFAULT_MODEL
except ImportError:
    from engine.ai.local_ai import LocalAIEngine, DEFAULT_MODEL

LOOKS = ["clean_studio", "warm_creator", "teal_and_orange", "vibrant_pop", "cyberpunk"]
MUSIC_MOODS = ["upbeat", "calm", "dramatic"]
TRANSITIONS = ["dip", "cut", "flash"]

_STOP_WORDS = {
    "the", "a", "an", "and", "or", "but", "so", "if", "then", "is", "are", "was", "were",
    "you", "your", "we", "our", "i", "my", "it", "its", "this", "that", "these", "those",
    "to", "of", "in", "on", "for", "with", "at", "by", "from", "up", "out", "about",
    "just", "like", "really", "very", "can", "will", "would", "should", "get", "got",
    "going", "know", "think", "want", "need", "make", "made", "them", "they", "there",
}


class AutoEditAgent:
    """
    Agentic auto-editor: turns a raw transcript into a structured edit plan
    (Remotion-style composition JSON) — what to cut, where B-roll cutaways go,
    music mood, transition style, and color grade. The plan is fully editable
    by the user and then executed by the GPU renderer.
    """

    def __init__(self, local_ai: Optional[LocalAIEngine] = None):
        self.local_ai = local_ai or LocalAIEngine()

    # ---------- helpers ----------

    @staticmethod
    def _merge_intervals(intervals: List[List[float]], min_gap: float = 0.35) -> List[Dict[str, float]]:
        merged: List[Dict[str, float]] = []
        for s, e in sorted(intervals):
            if e <= s:
                continue
            if merged and s - merged[-1]["end"] <= min_gap:
                merged[-1]["end"] = max(merged[-1]["end"], e)
            else:
                merged.append({"start": max(0.0, s), "end": e})
        return merged

    def keep_segments_from(self, speech_intervals: List[List[float]], filler_spans: List[List[float]], total_duration: float) -> List[Dict[str, float]]:
        """Speech intervals minus filler-word spans, merged into keep segments."""
        keep = []
        for s, e in speech_intervals or []:
            pieces = [(s, e)]
            for fs, fe in filler_spans or []:
                next_pieces = []
                for ps, pe in pieces:
                    if fe <= ps or fs >= pe:
                        next_pieces.append((ps, pe))
                        continue
                    if ps < fs:
                        next_pieces.append((ps, fs))
                    if fe < pe:
                        next_pieces.append((fe, pe))
                pieces = next_pieces
            keep.extend(pieces)
        if not keep:
            keep = [(0.0, total_duration)]
        return self._merge_intervals(keep)

    @staticmethod
    def _keyword_hints(words: List[Dict[str, Any]], n: int = 3) -> List[Dict[str, Any]]:
        """Offline B-roll picker: top fresh keywords from evenly spread windows."""
        if not words:
            return []
        duration = words[-1].get("end", 0)
        picks = []
        windows = max(1, min(n, int(duration // 8) or 1))
        for w in range(windows):
            t0 = duration * (w + 0.35) / windows
            window = [x for x in words if abs(x.get("start", 0) - t0) < 6]
            if not window:
                continue
            earlier = {p["keyword"].lower() for p in picks}
            counts = Counter(
                re.sub(r"[^\w]", "", str(x.get("word", "")).lower())
                for x in window
            )
            top = [
                wds for wds, _ in counts.most_common(12)
                if len(wds) > 4 and wds not in _STOP_WORDS and wds not in earlier
            ]
            if top:
                anchor = min(window, key=lambda x: abs(x.get("start", 0) - t0))
                picks.append({
                    "start": round(float(anchor.get("start", t0)), 2),
                    "end": round(float(anchor.get("start", t0)) + 2.5, 2),
                    "keyword": top[0].title(),
                    "source": "generated",
                    "reason": "Highlighted a key term the viewer should remember.",
                })
        return picks[:n]

    # ---------- agentic planning ----------

    def build_plan(
        self,
        words: List[Dict[str, Any]],
        transcript_text: str,
        keep_segments: List[Dict[str, float]],
        total_duration: float,
    ) -> Dict[str, Any]:
        """Produces the full editable edit plan. LLM-driven with honest fallback."""
        fallback_brolls = self._keyword_hints(words)
        llm_plan = self._llm_edit_plan(transcript_text, total_duration)

        brolls = (llm_plan or {}).get("brolls") or fallback_brolls
        # Clamp b-roll slots into the kept timeline and sanitize fields
        clean_brolls = []
        for i, b in enumerate(brolls[:6]):
            try:
                s = max(0.0, float(b.get("start", 0)))
                e = min(total_duration, s + max(1.2, min(3.0, float(b.get("end", s + 2.5)) - s)) if b.get("end") else s + 2.5)
            except Exception:
                continue
            if e - s < 1.0:
                continue
            clean_brolls.append({
                "id": f"broll_{i+1}",
                "start": round(s, 2),
                "end": round(e, 2),
                "keyword": str(b.get("keyword") or "key idea")[:40],
                "source": "generated",  # user files override this at render time
                "user_file": None,
                "reason": str(b.get("reason") or "")[:160],
            })

        music = (llm_plan or {}).get("music_mood")
        music_mood = music if music in MUSIC_MOODS else ("upbeat" if total_duration <= 45 else "calm")
        look = (llm_plan or {}).get("look")
        look = look if look in LOOKS else "clean_studio"
        transition = (llm_plan or {}).get("transition_style")
        transition = transition if transition in TRANSITIONS else "dip"

        plan = {
            "composition": {"width": 1080, "height": 1920, "fps": 30},
            "timeline": {
                "total_duration": round(total_duration, 2),
                "keep_segments": keep_segments,
            },
            "layers": {
                "brolls": clean_brolls,
                "captions": {"enabled": True, "style": "hormozi"},
                "music": {"enabled": True, "mood": music_mood},
                "grade": {"look": look},
                "transitions": {"style": transition},
            },
            "source": "ollama" if llm_plan else "offline-fallback",
        }
        return plan

    def _llm_edit_plan(self, transcript_text: str, total_duration: float) -> Optional[Dict[str, Any]]:
        if not transcript_text or not transcript_text.strip():
            return None
        system_prompt = (
            "You are an expert video editor agent. You read a transcript and decide the "
            "editorial plan: where visual B-roll cutaways belong, what each shows, the music "
            "mood, transition style, and color grade. Output valid JSON only."
        )
        user_prompt = f"""
        Transcript (timestamps are seconds into the video, total length {total_duration:.0f}s):
        \"\"\"{transcript_text[:6000]}\"\"\"

        Decide the edit plan:
        - 2 to 4 B-roll cutaway moments. Place each over a span of 1.5-3 seconds where the
          speaker explains a concept, names a thing, or cites a number — NOT over the opening
          hook and not in the final 3 seconds. "keyword" is 1-3 words describing a visual a
          viewer should picture. "reason" explains the choice in one short sentence.
        - music_mood: one of "upbeat", "calm", "dramatic" — pick what fits the content's energy.
        - look: one of "clean_studio" (natural), "warm_creator" (warm), "teal_and_orange"
          (cinematic), "vibrant_pop" (vivid), "cyberpunk" (moody).
        - transition_style: "dip" (soft black dip), "cut" (hard cut), "flash" (white flash).

        Return JSON strictly:
        {{
            "brolls": [
                {{"start": 12.0, "end": 14.5, "keyword": "...", "reason": "..."}}
            ],
            "music_mood": "upbeat",
            "look": "clean_studio",
            "transition_style": "dip"
        }}
        """
        raw = self.local_ai._call_local_llm(user_prompt, system_prompt)
        if not raw:
            return None
        parsed = self.local_ai._extract_json(raw)
        if not parsed or not isinstance(parsed.get("brolls", []), list):
            return None
        return parsed
