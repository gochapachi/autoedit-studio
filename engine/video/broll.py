import os
import subprocess
import logging
import tempfile
from typing import Optional

logger = logging.getLogger("AutoEdit.BRoll")

# Cinematic gradient pairs (top, bottom) + matching accent color
PALETTES = [
    ("0x0b1026", "0x1d4ed8", "0x38bdf8"),  # midnight → royal blue, sky accent
    ("0x1a0b2e", "0x6d28d9", "0xa78bfa"),  # deep violet → purple, lilac accent
    ("0x04121f", "0x0e7490", "0x22d3ee"),  # abyss → teal, cyan accent
    ("0x1c0a0a", "0xb45309", "0xfbbf24"),  # espresso → amber, gold accent
    ("0x0f172a", "0x334155", "0xe2e8f0"),  # graphite, silver accent
]

_FONT_CANDIDATES = [
    r"C:\Windows\Fonts\arialbd.ttf",
    r"C:\Windows\Fonts\arial.ttf",
    r"C:\Windows\Fonts\segoeuib.ttf",
    r"C:\Windows\Fonts\segoeui.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def _find_font() -> Optional[str]:
    for f in _FONT_CANDIDATES:
        if os.path.exists(f):
            return f
    return None


def _wrap_text(text: str, max_chars: int = 13) -> str:
    words = text.split()
    lines, current = [], ""
    for w in words:
        if len(current) + len(w) + 1 > max_chars and current:
            lines.append(current)
            current = w
        else:
            current = f"{current} {w}".strip()
    if current:
        lines.append(current)
    return "\n".join(lines[:3])


def _path_arg(path: str) -> str:
    """Filters a path into ffmpeg's escaped, quoted form (forward slashes, escaped colon)."""
    escaped = path.replace("\\", "/").replace(":", "\\:")
    return f"'{escaped}'"


class BRollGenerator:
    """
    Generates cinematic B-roll cutaway cards 100% locally: layered gradient
    backdrop with film grain and vignette, a dim content band, a kicker label,
    the keyword, and an accent bar. Fades baked in.

    Text is delivered via drawtext's `textfile` option — inline quoted text with
    newlines/spaces across multiple drawtext filters trips the filtergraph
    parser, a plain temp-file path does not.
    """

    def __init__(self, ffmpeg_exe: str = "ffmpeg"):
        self.ffmpeg_exe = ffmpeg_exe

    def generate_card(
        self,
        text: str,
        output_path: str,
        duration: float = 2.0,
        width: int = 1080,
        height: int = 1920,
        palette_index: int = 0,
        fps: int = 30,
    ) -> Optional[str]:
        if not text or not text.strip():
            return None
        out_dir = os.path.dirname(os.path.abspath(output_path))
        os.makedirs(out_dir, exist_ok=True)

        duration = max(duration, 0.8)
        font = _find_font()
        c0, c1, accent = PALETTES[palette_index % len(PALETTES)]

        wrapped = _wrap_text(text.strip())
        fd, text_file = tempfile.mkstemp(suffix=".txt", prefix="broll_kw_")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(wrapped)

        font_arg = ""
        if font:
            font_arg = f"fontfile={_path_arg(font)}:"

        band_top = int(height * 0.36)
        band_h = int(height * 0.30)
        keyword_y = int(height * 0.465)
        drift = 220

        vf = (
            f"gradients=s={width}x{height + 2 * drift}:c0={c0}:c1={c1}:d={duration}:speed=0.02,"
            f"crop={width}:{height}:0:'{drift}+{drift}*sin(2*PI*t/{duration * 2:.2f})',"
            f"noise=alls=6:allf=t+u,"
            f"vignette=PI/4.5,"
            f"drawbox=y={band_top}:w=iw:h={band_h}:color=black@0.32:t=fill,"
            f"drawtext={font_arg}text=KEY-MOMENT:fontcolor=white@0.65:fontsize=34:"
            f"x=(w-text_w)/2:y={band_top + 70},"
            f"drawtext={font_arg}textfile={_path_arg(text_file)}:fontcolor=white:fontsize=118:"
            f"line_spacing=42:x=(w-text_w)/2:y={keyword_y},"
            f"drawbox=x=(iw-150)/2:y={keyword_y + 320}:w=150:h=9:color={accent}@0.95:t=fill,"
            f"fade=t=in:st=0:d=0.28,fade=t=out:st={duration - 0.28:.2f}:d=0.28,"
            f"format=yuv420p"
        )

        cmd = [
            self.ffmpeg_exe, "-y",
            "-f", "lavfi", "-i", vf,
            "-t", f"{duration:.2f}",
            "-r", str(fps),
            "-c:v", "libx264", "-preset", "fast", "-crf", "20",
            output_path,
        ]
        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if res.returncode == 0 and os.path.exists(output_path):
                return output_path
            logger.warning(f"B-roll card render failed: {res.stderr[-400:]}")
            return None
        except Exception as e:
            logger.warning(f"B-roll card render error: {e}")
            return None
        finally:
            try:
                os.remove(text_file)
            except OSError:
                pass
