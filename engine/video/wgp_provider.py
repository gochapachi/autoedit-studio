import os
import sys
import json
import shutil
import logging
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable

logger = logging.getLogger("AutoEdit.WanGPProvider")

# Wan2GP (github.com/deepbeepmeep/Wan2GP) runs open Ideogram v4, Krea 2 and
# LTX-2 (GGUF) generation models in under 8GB VRAM. Its official in-process
# Python API (shared/api.py) is used here for B-roll generation.

DEFAULT_ROOTS = [
    r"D:\Wan2gp",
    r"D:\WanGP",
    r"C:\WanGP",
    r"D:\wan2gp",
]

# B-roll generation recipes: Wan2GP defaults file + the model_type it exports.
# LTX-2 22B distilled GGUF q4_k_m is the 8GB-friendly video model; Ideogram v4
# and Krea 2 turbo generate stills that get animated into cutaway clips.
VIDEO_DEFAULT = "ltx2_22B_distilled_gguf_q4_k_m"
IMAGE_PROVIDERS = {
    "wgp_ideogram": "ideogram4",
    "wgp_krea": "krea2_turbo",
}


class WanGPProvider:
    """
    Generates B-roll clips through a local Wan2GP installation using its
    official in-process API. All generation stays on this PC's GPU.
    """

    def __init__(self, ffmpeg_exe: str = "ffmpeg"):
        self.ffmpeg_exe = ffmpeg_exe
        self._session = None
        self._root: Optional[Path] = None
        self._api = None

    # ---------- discovery / session ----------

    def find_root(self) -> Optional[Path]:
        if self._root:
            return self._root
        env = os.getenv("AUTOEDIT_WGP_ROOT")
        candidates = [Path(env)] if env else [Path(p) for p in DEFAULT_ROOTS]
        for c in candidates:
            if (c / "shared" / "api.py").exists():
                self._root = c
                return c
        return None

    def available(self) -> Dict[str, Any]:
        root = self.find_root()
        if not root:
            return {"available": False, "reason": "Wan2GP not found. Install it from github.com/deepbeepmeep/Wan2GP (works in <8GB VRAM)."}
        return {"available": True, "root": str(root), "reason": None}

    def _ensure_session(self):
        if self._session is not None:
            return self._session
        root = self.find_root()
        if root is None:
            raise RuntimeError("Wan2GP installation not found.")
        if str(root) not in sys.path:
            sys.path.insert(0, str(root))
        from shared.api import init  # noqa: E402 — Wan2GP's official API

        profile = os.getenv("AUTOEDIT_WGP_PROFILE", "4")  # low-VRAM profile
        self._session = init(root=root, cli_args=["--profile", profile])
        return self._session

    def _load_defaults(self, name: str) -> Dict[str, Any]:
        root = self.find_root()
        path = root / "defaults" / f"{name}.json"
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    # ---------- generation ----------

    def generate_video_clip(
        self,
        prompt: str,
        duration: float,
        out_dir: str,
        progress_cb: Optional[Callable[[int, str], None]] = None,
    ) -> Optional[str]:
        """Text-to-video B-roll via LTX-2 (GGUF, low VRAM). Returns the clip path."""
        settings = self._load_defaults(VIDEO_DEFAULT)
        settings["prompt"] = f"Cinematic vertical b-roll: {prompt}. Vertical 9:16 composition."
        settings["duration_seconds"] = max(2, min(5, round(duration)))
        settings["force_fps"] = settings.get("force_fps", 24)
        files = self._submit(settings, progress_cb, job_kind="LTX-2 video")
        for f in files or []:
            if str(f).lower().endswith((".mp4", ".webm", ".mov", ".mkv")):
                return self._import(f, out_dir, "broll_wgp_video")
        return None

    def generate_image_clip(
        self,
        provider_id: str,
        prompt: str,
        duration: float,
        out_dir: str,
        palette_hint: str = "clean",
        progress_cb: Optional[Callable[[int, str], None]] = None,
    ) -> Optional[str]:
        """Text-to-image (Ideogram v4 / Krea 2) → animated Ken Burns cutaway clip."""
        default_name = IMAGE_PROVIDERS.get(provider_id)
        if not default_name:
            return None
        settings = self._load_defaults(default_name)
        settings["prompt"] = f"Vertical 9:16 b-roll still photo: {prompt}. {palette_hint} look, no text, no watermark."
        files = self._submit(settings, progress_cb, job_kind=provider_id)
        image = None
        for f in files or []:
            if str(f).lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                image = str(f)
                break
        if not image:
            return None
        return self._ken_burns_clip(image, duration, out_dir)

    def _submit(self, settings: Dict[str, Any], progress_cb, job_kind: str) -> Optional[List[str]]:
        session = self._ensure_session()
        job = session.submit_task(settings)
        for event in job.events.iter(timeout=0.5):
            try:
                if event.kind == "progress" and progress_cb:
                    pct = int(getattr(event.data, "progress", 0) or 0)
                    progress_cb(min(95, max(5, pct)), f"Generating B-roll ({job_kind})…")
            except Exception:
                pass
        result = job.result()
        if getattr(result, "success", False):
            return list(getattr(result, "generated_files", []) or [])
        errors = [getattr(e, "message", str(e)) for e in (getattr(result, "errors", None) or [])]
        raise RuntimeError(f"WanGP {job_kind} generation failed: {'; '.join(errors)}")

    def _import(self, src: str, out_dir: str, stem: str) -> str:
        os.makedirs(out_dir, exist_ok=True)
        dest = os.path.join(out_dir, f"{stem}_{os.path.basename(src)}")
        shutil.copy2(src, dest)
        return dest

    def _ken_burns_clip(self, image_path: str, duration: float, out_dir: str) -> Optional[str]:
        """Turns a generated still into a gently zooming clip with fades."""
        duration = max(duration, 1.2)
        os.makedirs(out_dir, exist_ok=True)
        out = os.path.join(out_dir, f"broll_img_{os.path.splitext(os.path.basename(image_path))[0]}.mp4")
        frames = int(duration * 30)
        # Oversize the source, then zoom+pan across it via zoompan
        vf = (
            f"scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,"
            f"zoompan=z='1+0.12*on/{frames}':x='iw/2-(iw/zoom)/2':y='ih/2-(ih/zoom)/2'"
            f":d={frames}:s=1080x1920:fps=30,"
            f"fade=t=in:st=0:d=0.25,fade=t=out:st={duration - 0.25:.2f}:d=0.25,format=yuv420p"
        )
        cmd = [
            self.ffmpeg_exe, "-y", "-loop", "1", "-i", image_path,
            "-vf", vf, "-t", f"{duration:.2f}",
            "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-r", "30",
            out,
        ]
        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if res.returncode == 0 and os.path.exists(out):
                return out
            logger.warning(f"Ken Burns clip failed: {res.stderr[-300:]}")
        except Exception as e:
            logger.warning(f"Ken Burns clip error: {e}")
        return None
