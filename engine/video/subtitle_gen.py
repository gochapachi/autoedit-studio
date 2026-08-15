import os
import re
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("AutoEdit.SubtitleGen")

EMOJI_DICTIONARY = {
    "money": "💰", "cash": "💵", "profit": "📈", "dollar": "💵", "rich": "🤑", "million": "💸", "billion": "💎",
    "growth": "🚀", "scale": "📈", "fast": "⚡", "quick": "⚡", "speed": "🏎️", "rocket": "🚀",
    "stop": "🛑", "wrong": "❌", "never": "🚫", "warning": "⚠️", "danger": "🚨", "mistake": "🤦‍♂️",
    "secret": "🤫", "hack": "🧠", "trick": "🪄", "smart": "💡", "idea": "💡", "brain": "🧠",
    "fire": "🔥", "crazy": "🤯", "insane": "🤯", "huge": "💥", "win": "🏆", "best": "⭐",
    "video": "🎥", "camera": "📸", "ai": "🤖", "bot": "🤖", "code": "💻", "phone": "📱"
}

PRESET_STYLES = {
    "hormozi": {
        "fontname": "Montserrat",
        "fontsize": 24,
        "primary_color": "&H00FFFFFF",     # White
        "active_color": "&H0000E5FF",      # Bright Golden Yellow
        "outline_color": "&H00000000",     # Deep Black
        "outline_width": 4.0,
        "shadow": 2.5,
        "bold": 1,
        "all_caps": True
    },
    "mrbeast": {
        "fontname": "Impact",
        "fontsize": 28,
        "primary_color": "&H00FFFFFF",
        "active_color": "&H0000FF00",      # Bright Neon Green
        "outline_color": "&H00000000",
        "outline_width": 5.0,
        "shadow": 3.0,
        "bold": 1,
        "all_caps": True
    },
    "minimalist": {
        "fontname": "Inter",
        "fontsize": 20,
        "primary_color": "&H00A0A0A0",     # Muted grey
        "active_color": "&H00FFFFFF",      # Crisp white
        "outline_color": "&H40000000",
        "outline_width": 1.5,
        "shadow": 0.0,
        "bold": 0,
        "all_caps": False
    },
    "cyberpunk": {
        "fontname": "Arial Black",
        "fontsize": 22,
        "primary_color": "&H00FFFF00",     # Neon Cyan
        "active_color": "&H00FF00FF",      # Neon Magenta
        "outline_color": "&H00200020",
        "outline_width": 3.5,
        "shadow": 2.0,
        "bold": 1,
        "all_caps": True
    }
}

class SubtitleGenerator:
    """
    Generates word-by-word kinetic karaoke subtitles with active bouncing,
    color highlights, and auto-injected contextual animated emojis.
    """
    def __init__(self):
        pass

    def _get_emoji_for_word(self, word: str) -> Optional[str]:
        clean = re.sub(r'[^\w]', '', word.lower())
        return EMOJI_DICTIONARY.get(clean)

    def generate_ass_subtitles(self, words: List[Dict[str, Any]], output_path: str, style_name: str = "hormozi", video_width: int = 1080, video_height: int = 1920) -> str:
        """
        Builds ASS subtitle file with word-by-word active highlight tags.
        """
        style = PRESET_STYLES.get(style_name.lower(), PRESET_STYLES["hormozi"])
        
        # Group words into short 2-4 word readable chunks
        chunks = []
        curr_chunk = []
        for w in words:
            curr_chunk.append(w)
            # Break chunk on punctuation or every 3-4 words
            if len(curr_chunk) >= 3 or w.get("word", "").endswith((".", "!", "?", ",")):
                chunks.append(curr_chunk)
                curr_chunk = []
        if curr_chunk:
            chunks.append(curr_chunk)

        header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {video_width}
PlayResY: {video_height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{style['fontname']},{style['fontsize'] * 2.2},{style['primary_color']},{style['active_color']},{style['outline_color']},&H80000000,{style['bold']},0,0,0,100,100,0,0,1,{style['outline_width'] * 2},{style['shadow'] * 2},2,40,40,{int(video_height * 0.28)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        events = []

        for chunk in chunks:
            if not chunk:
                continue
            chunk_start = chunk[0].get("start", 0.0)
            chunk_end = chunk[-1].get("end", chunk_start + 1.0)
            
            # Format times to H:MM:SS.cs
            start_str = self._format_ass_time(chunk_start)
            end_str = self._format_ass_time(chunk_end)

            # Build karaoke line
            line_parts = []
            for w in chunk:
                w_text = w.get("word", "")
                if style["all_caps"]:
                    w_text = w_text.upper()
                
                emoji = self._get_emoji_for_word(w_text)
                if emoji:
                    w_text = f"{emoji} {w_text}"

                dur_cs = int((w.get("end", 0.0) - w.get("start", 0.0)) * 100)
                dur_cs = max(10, dur_cs)
                line_parts.append(f"{{\\k{dur_cs}}}{w_text}")

            full_line_text = " ".join(line_parts)
            events.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{full_line_text}")

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(header + "\n".join(events))

        return output_path

    def _format_ass_time(self, seconds: float) -> str:
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        cs = int(round((seconds - int(seconds)) * 100))
        return f"{h}:{m:02d}:{s:02d}.{cs:02d}"
