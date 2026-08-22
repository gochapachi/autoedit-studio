import os
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("AutoEdit.HookBanner")

# Windows fontconfig builds often can't load a default config, so drawtext
# needs an explicit fontfile. Prefer bold sans fonts, fall back to any ttf.
_FONT_CANDIDATES = [
    r"C:\Windows\Fonts\arialbd.ttf",
    r"C:\Windows\Fonts\arial.ttf",
    r"C:\Windows\Fonts\segoeui.ttf",
    r"C:\Windows\Fonts\DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]

def _find_font_file() -> Optional[str]:
    for f in _FONT_CANDIDATES:
        if os.path.exists(f):
            return f
    return None

class TopHookBanner:
    """
    Renders a high-contrast curiosity headline banner across the top 20% of the video
    during the first 3.0 seconds to stop the user from scrolling past.
    """
    def __init__(self):
        pass

    def get_ffmpeg_drawtext_filter(self, banner_text: str, duration_sec: float = 3.0, font_size: int = 42) -> str:
        """
        Builds FFmpeg drawtext filter with yellow/white font and dark rounded backdrop.
        """
        if not banner_text:
            return ""

        escaped = banner_text.replace(":", "\\:").replace("'", "\\'").replace("%", "%%")
        font_file = _find_font_file()
        font_arg = ""
        if font_file:
            # Escape drive colon for the filter parser and use forward slashes
            ff = font_file.replace("\\", "/").replace(":", "\\:")
            font_arg = f":fontfile='{ff}'"

        # Display between 0.0s and duration_sec
        filter_str = (
            f"drawbox=y=120:color=black@0.75:width=iw:height=140:t=fill:enable='between(t,0,{duration_sec})',"
            f"drawtext=text='{escaped}'{font_arg}:fontcolor=yellow:fontsize={font_size}:x=(w-text_w)/2:y=165:enable='between(t,0,{duration_sec})'"
        )
        return filter_str
