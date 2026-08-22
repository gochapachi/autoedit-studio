import os
import sys
import json
import shutil
import subprocess
import logging
from typing import Dict, Any, Optional, Callable

logger = logging.getLogger("AutoEdit.MotionCards")

# Path to the Remotion card studio shipped inside the frontend app
STUDIO_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "app", "broll-studio",
)


class MotionCardRenderer:
    """
    Renders motion-design B-roll and overlay cards through the bundled Remotion
    studio (transparent VP8/WebM), so cards composite over the video with real
    spring animations, staggered type and accent wipes — no cloud, runs locally
    via headless Chromium managed by @remotion/renderer.
    """

    def __init__(self, node_exe: Optional[str] = None):
        self.node_exe = node_exe or shutil.which("node") or shutil.which("node.exe")
        self._headless_ready = False

    def available(self) -> Dict[str, Any]:
        if not os.path.isdir(STUDIO_DIR) or not os.path.exists(os.path.join(STUDIO_DIR, "render.mjs")):
            return {"available": False, "reason": "Remotion card studio not found in the app folder."}
        if not self.node_exe:
            return {"available": False, "reason": "Node.js not found. Install Node 18+ from nodejs.org."}
        if not os.path.isdir(os.path.join(STUDIO_DIR, "node_modules")):
            return {"available": False, "reason": "Motion studio not installed yet (run npm install in app/broll-studio)."}
        return {"available": True, "studio": STUDIO_DIR, "reason": None}

    def render_card(
        self,
        keyword: str,
        kind: str,
        output_path: str,
        palette_index: int = 0,
        kicker: str = "key moment",
        progress_cb: Optional[Callable[[int, str], None]] = None,
    ) -> Optional[str]:
        """
        Renders one card. kind: "broll" (full-frame cutaway) or "overlay"
        (compact card floating over the video). Returns the webm path.
        """
        status = self.available()
        if not status.get("available"):
            logger.warning(f"Motion cards unavailable: {status.get('reason')}")
            return None

        composition = "BrollCard" if kind == "broll" else "OverlayCard"
        props = {"keyword": keyword[:60], "palette": palette_index, "kind": kind, "kicker": kicker}
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

        cmd = [
            self.node_exe, "render.mjs", composition, output_path, json.dumps(props),
        ]
        try:
            # First render downloads Remotion's headless Chromium (~150MB, one time)
            proc = subprocess.Popen(
                cmd, cwd=STUDIO_DIR,
                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                text=True, encoding="utf-8", errors="replace",
            )
            last = 0
            for line in proc.stdout or []:
                line = line.strip()
                if not line.startswith("{"):
                    continue
                try:
                    data = json.loads(line)
                except Exception:
                    continue
                pct = data.get("progress")
                if isinstance(pct, int) and pct > last:
                    last = pct
                    if progress_cb:
                        progress_cb(min(95, pct), f"Rendering motion card ({pct}%)…")
                if data.get("bundling") is not None and progress_cb:
                    progress_cb(5, "Preparing motion studio (one-time)…")
                if data.get("done"):
                    if progress_cb:
                        progress_cb(100, "Motion card ready")
            proc.wait()
            if proc.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 10_000:
                return output_path
            err = (proc.stderr.read() if proc.stderr else "") or f"exit {proc.returncode}"
            logger.warning(f"Motion card render failed: {err[-400:]}")
            return None
        except Exception as e:
            logger.warning(f"Motion card render error: {e}")
            return None
