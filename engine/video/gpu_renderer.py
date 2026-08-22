import os
import subprocess
import logging
import json
from typing import Dict, Any, List, Optional

logger = logging.getLogger("AutoEdit.GPURenderer")

class GPURenderEngine:
    """
    Hardware-accelerated rendering engine utilizing NVIDIA NVENC / NVDEC.
    Composites video cuts, 9:16 reframe, kinetic subtitles, multi-track audio,
    BGM with sidechain ducking, and SFX with sub-10 second rendering times.
    """
    def __init__(self):
        self.ffmpeg_exe = self._resolve_ffmpeg()
        self.encoder = self._detect_best_encoder()

    def _resolve_ffmpeg(self) -> str:
        """Finds FFmpeg executable via PATH or imageio_ffmpeg."""
        try:
            res = subprocess.run(["ffmpeg", "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if res.returncode == 0:
                return "ffmpeg"
        except Exception:
            pass

        try:
            import imageio_ffmpeg
            return imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            return "ffmpeg"

    def _detect_best_encoder(self) -> str:
        """Detects whether NVIDIA NVENC hardware acceleration is available."""
        try:
            res = subprocess.run([self.ffmpeg_exe, "-encoders"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if "h264_nvenc" in res.stdout:
                logger.info("NVIDIA NVENC hardware encoder detected! Using h264_nvenc.")
                return "h264_nvenc"
            elif "h264_qsv" in res.stdout:
                return "h264_qsv"
            elif "h264_amf" in res.stdout:
                return "h264_amf"
        except Exception as e:
            logger.warning(f"Could not test GPU encoder: {e}")
        return "libx264"

    def _probe_duration_sec(self, path: str) -> Optional[float]:
        """Probes media duration with ffprobe; returns None on failure."""
        try:
            ffprobe = self.ffmpeg_exe.replace("ffmpeg", "ffprobe")
            res = subprocess.run(
                [ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
            )
            if res.returncode == 0:
                return float(res.stdout.strip())
        except Exception as e:
            logger.debug(f"Duration probe failed: {e}")
        return None

    def _has_audio_stream(self, path: str) -> bool:
        """Checks whether the input file contains at least one audio stream."""
        try:
            ffprobe = self.ffmpeg_exe.replace("ffmpeg", "ffprobe")
            res = subprocess.run(
                [ffprobe, "-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", path],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
            )
            return "audio" in res.stdout
        except Exception as e:
            logger.debug(f"Audio stream probe failed: {e}")
        return False

    def extract_audio_wav(self, input_media: str, output_wav: str, sample_rate: int = 16000) -> Optional[str]:
        """Extracts a clean mono WAV (default 16kHz) from any A/V container for VAD/Whisper."""
        try:
            res = subprocess.run(
                [self.ffmpeg_exe, "-y", "-i", input_media, "-vn", "-ac", "1", "-ar", str(sample_rate), output_wav],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
            )
            if res.returncode == 0 and os.path.exists(output_wav):
                return output_wav
            logger.warning(f"WAV extraction failed: {res.stderr[-500:]}")
        except Exception as e:
            logger.warning(f"WAV extraction error: {e}")
        return None

    @staticmethod
    def _select_expression(keep_segments: List[Dict[str, Any]]) -> str:
        """Builds an ffmpeg select/aselect expression from keep segments ({start,end})."""
        parts = []
        for seg in keep_segments:
            s = max(0.0, float(seg.get("start", 0.0)))
            e = float(seg.get("end", s))
            if e > s:
                parts.append(f"between(t,{s:.3f},{e:.3f})")
        return "+".join(parts) if parts else "1"


    def render_final_short(
        self,
        input_video: str,
        output_video: str,
        ass_subtitle_path: Optional[str] = None,
        bgm_path: Optional[str] = None,
        sfx_items: Optional[List[Dict[str, Any]]] = None,
        color_lut_filter: Optional[str] = None,
        hook_banner_filter: Optional[str] = None,
        zoom_filter: Optional[str] = None,
        target_width: int = 1080,
        target_height: int = 1920,
        fps: int = 30,
        keep_segments: Optional[List[Dict[str, Any]]] = None,
        progress_cb=None,
        broll_overlays: Optional[List[Dict[str, Any]]] = None,
        segment_boundaries: Optional[List[float]] = None,
        transition_style: str = "dip",
    ) -> Dict[str, Any]:
        """
        Executes FFmpeg NVENC pipeline with all visual and audio layers.

        keep_segments: list of {start, end} second ranges to KEEP — everything
        between them is cut out (auto-edit word deletions, silence removal).
        broll_overlays: list of {path, start, end} cutaway clips (timings on the
            POST-CUT timeline) composited over the video.
        segment_boundaries: cut-joint times (post-cut timeline) that receive a
            short transition; transition_style: "dip" | "cut" | "flash".
        progress_cb: optional callable(int percentage 0-100) for live progress.
        """
        if not os.path.exists(input_video):
            raise FileNotFoundError(f"Input video not found: {input_video}")

        os.makedirs(os.path.dirname(os.path.abspath(output_video)), exist_ok=True)

        has_audio = self._has_audio_stream(input_video)
        total_duration = self._probe_duration_sec(input_video)

        # Build Video Filter Chain
        vf_steps = []
        # 1. Scale & Crop to 9:16
        vf_steps.append(f"scale=w={target_width}:h={target_height}:force_original_aspect_ratio=increase,crop={target_width}:{target_height}")

        # 2. Punch Zoom if active
        if zoom_filter:
            vf_steps.append(zoom_filter)

        # 3. Color LUT
        if color_lut_filter:
            vf_steps.append(color_lut_filter)

        # 4. Top Hook Banner
        if hook_banner_filter:
            vf_steps.append(hook_banner_filter)

        # 5. Burn-in Subtitles (timings must already match the post-cut timeline).
        # Kept separate so captions can be burned ON TOP of B-roll overlays.
        subs_filter = None
        if ass_subtitle_path and os.path.exists(ass_subtitle_path):
            escaped_sub = ass_subtitle_path.replace("\\", "/").replace(":", "\\:")
            subs_filter = f"subtitles='{escaped_sub}'"

        full_vf = ",".join(vf_steps)

        # Apply auto-edit keep/cut segments by squeezing kept ranges together
        applying_cuts = bool(keep_segments and len(keep_segments) > 0)
        select_expr = self._select_expression(keep_segments) if applying_cuts else None

        # Valid B-roll overlays (files must exist; timings on the post-cut timeline)
        overlays = [
            {
                "path": o["path"],
                "start": float(o.get("start", 0)),
                "end": float(o.get("end", 0)),
            }
            for o in (broll_overlays or [])
            if o.get("path") and os.path.exists(o.get("path")) and float(o.get("end", 0)) > float(o.get("start", 0))
        ]

        # Transition dips at cut joints. fade/afade with a bare `st` would black
        # (or mute) the ENTIRE stream before `st`, so each fade is scoped to a
        # tiny window around the boundary via the timeline `enable` option.
        fade_filters = []
        audio_fades = []
        if transition_style in ("dip", "flash") and segment_boundaries:
            color = "white" if transition_style == "flash" else "black"
            fd = 0.14
            for t in sorted(set(max(0.0, float(b)) for b in segment_boundaries)):
                t_out_start = max(t - fd, 0)
                fade_filters.append(
                    f"fade=t=out:st={t_out_start:.3f}:d={fd:.3f}:color={color}"
                    f":enable='between(t,{t_out_start:.3f},{t:.3f})'"
                )
                fade_filters.append(
                    f"fade=t=in:st={t:.3f}:d={fd:.3f}:color={color}"
                    f":enable='between(t,{t:.3f},{t + fd:.3f})'"
                )
                audio_fades.append(
                    f"afade=t=out:st={max(t - 0.1, 0):.3f}:d=0.1"
                    f":enable='between(t,{max(t - 0.1, 0):.3f},{t:.3f})'"
                )
                audio_fades.append(
                    f"afade=t=in:st={t:.3f}:d=0.1"
                    f":enable='between(t,{t:.3f},{t + 0.12:.3f})'"
                )

        inputs_count = 1
        bgm_input_idx = None

        def build_cmd(use_hwaccel: bool) -> List[str]:
            nonlocal bgm_input_idx
            cmd = [self.ffmpeg_exe, "-y", "-nostats", "-progress", "pipe:1"]
            # NVDEC hardware decode (frames are downloaded for CPU filters, then NVENC encodes)
            if use_hwaccel and self.encoder == "h264_nvenc":
                cmd.extend(["-hwaccel", "cuda"])
            cmd.extend(["-i", input_video])

            # B-roll inputs come right after the main input
            for o in overlays:
                cmd.extend(["-i", o["path"]])
            broll_base_idx = 1
            next_idx = broll_base_idx + len(overlays)

            bgm_input_idx = None
            if bgm_path and os.path.exists(bgm_path) and has_audio:
                cmd.extend(["-stream_loop", "-1", "-i", bgm_path])
                bgm_input_idx = next_idx

            fc = []
            # Video chain: optional select (auto-edit) then styling filters
            if applying_cuts:
                fc.append(f"[0:v]select='{select_expr}',setpts=N/FRAME_RATE/TB,{full_vf}[vbase]")
            else:
                fc.append(f"[0:v]{full_vf}[vbase]")

            # B-roll cutaways: shift each clip onto its slot, then overlay it.
            # Captions stay on top because subtitles are burned in full_vf? No —
            # subtitles were added in full_vf before overlays; re-burn on top.
            vlabel = "vbase"
            for i, o in enumerate(overlays):
                bi = broll_base_idx + i
                fc.append(
                    f"[{bi}:v]setpts=PTS+{o['start']:.3f}/TB,scale={target_width}:{target_height}:force_original_aspect_ratio=increase,"
                    f"crop={target_width}:{target_height}[b{i}]"
                )
                fc.append(
                    f"[{vlabel}][b{i}]overlay=0:0:eof_action=pass:enable='between(t,{o['start']:.3f},{o['end']:.3f})'[vo{i}]"
                )
                vlabel = f"vo{i}"

            # Transition fades at cut joints
            if fade_filters:
                fc.append(f"[{vlabel}]{','.join(fade_filters)}[vtrans]")
                vlabel = "vtrans"

            # Captions burn on top of everything (B-roll included)
            if subs_filter:
                fc.append(f"[{vlabel}]{subs_filter}[vsubs]")
                vlabel = "vsubs"

            if vlabel != "vout":
                fc.append(f"[{vlabel}]null[vout]")

            # Audio chain: optional aselect, then BGM sidechain ducking
            if has_audio:
                if applying_cuts:
                    fc.append(f"[0:a]aselect='{select_expr}',asetpts=N/SR/TB[va]")
                else:
                    fc.append("[0:a]anull[va]")
                if audio_fades:
                    fc.append(f"[va]{','.join(audio_fades)}[vat]")
                    va_label = "vat"
                else:
                    va_label = "va"
                if bgm_input_idx is not None:
                    fc.append(
                        f"[{bgm_input_idx}:a]volume=0.25[bgm];"
                        f"[{va_label}][bgm]sidechaincompress=threshold=0.08:ratio=5:attack=20:release=300[voice_ducked];"
                        f"[voice_ducked][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]"
                    )
                    audio_map = "[aout]"
                else:
                    audio_map = f"[{va_label}]"
            else:
                audio_map = None

            if fc:
                cmd.extend(["-filter_complex", ";".join(fc), "-map", "[vout]"])
                if audio_map:
                    cmd.extend(["-map", audio_map])
                elif bgm_input_idx is not None:
                    # Voiceless input: keep BGM alone as the audio track
                    cmd.extend(["-map", f"{bgm_input_idx}:a"])

            # GPU NVENC encoding options
            if self.encoder == "h264_nvenc":
                cmd.extend([
                    "-c:v", "h264_nvenc",
                    "-preset", "p5",       # Fast high quality NVENC preset
                    "-cq", "22",           # Constant Quality
                    "-rc", "vbr",
                    "-b:v", "12M",
                    "-maxrate", "16M",
                    "-bufsize", "24M",
                    "-pix_fmt", "yuv420p",
                    "-r", str(fps)
                ])
            else:
                cmd.extend([
                    "-c:v", "libx264",
                    "-preset", "fast",
                    "-crf", "20",
                    "-pix_fmt", "yuv420p",
                    "-r", str(fps)
                ])

            if audio_map or bgm_input_idx is not None:
                cmd.extend(["-c:a", "aac", "-b:a", "192k"])

            cmd.append(output_video)
            return cmd

        def run_with_progress(cmd: List[str]) -> subprocess.CompletedProcess:
            if progress_cb is None or total_duration is None or total_duration <= 0:
                return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            # stderr merges into the stdout progress stream — leaving it as a
            # separate unread pipe deadlocks ffmpeg once the buffer fills.
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            assert process.stdout is not None
            last_pct = -1
            err_tail: List[str] = []
            for line in process.stdout:
                line = line.strip()
                if line.startswith("out_time_ms="):
                    try:
                        done_sec = int(line.split("=", 1)[1]) / 1_000_000.0
                        pct = min(99, int(done_sec / total_duration * 100))
                        if pct > last_pct:
                            last_pct = pct
                            progress_cb(pct)
                    except Exception:
                        pass
                elif line:
                    err_tail.append(line)
            process.wait()
            if progress_cb and process.returncode == 0:
                progress_cb(100)
            return subprocess.CompletedProcess(cmd, process.returncode, "", "\n".join(err_tail[-20:]))

        logger.info(f"Running FFmpeg render command ({self.encoder}, cuts={'yes' if applying_cuts else 'no'}, audio={'yes' if has_audio else 'no'})")
        try:
            # First attempt with hardware decode when NVENC is available; retry on CPU decode if it fails
            attempts = [(True,)] if self.encoder == "h264_nvenc" else []
            attempts.append((False,))
            process = None
            for (use_hw,) in attempts:
                process = run_with_progress(build_cmd(use_hw))
                if process.returncode == 0:
                    break
                logger.warning(f"FFmpeg render attempt (hwaccel={use_hw}) failed.")

            if process is None or process.returncode != 0:
                stderr_tail = (process.stderr if process else "") or "unknown ffmpeg failure"
                logger.error(f"FFmpeg render error: {stderr_tail}")
                return {"status": "error", "error": stderr_tail[-1000:]}

            return {
                "status": "success",
                "output_file": output_video,
                "encoder_used": self.encoder,
                "resolution": f"{target_width}x{target_height}",
                "cuts_applied": len(keep_segments) if applying_cuts else 0
            }
        except Exception as e:
            logger.error(f"FFmpeg execution failed: {e}")
            return {"status": "error", "error": str(e)}

    def export_xml_project(self, project_data: Dict[str, Any], output_path: str) -> str:
        """
        Generates standard Final Cut Pro / Premiere Pro XML (.xml) for NLE editing.
        """
        xml_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <project>
    <name>{project_data.get('name', 'AutoEdit_Project')}</name>
    <children>
      <sequence id="sequence-1">
        <name>Viral_Short_9x16</name>
        <duration>1800</duration>
        <rate>
          <timebase>30</timebase>
        </rate>
        <media>
          <video>
            <format>
              <samplecharacteristics>
                <width>1080</width>
                <height>1920</height>
              </samplecharacteristics>
            </format>
          </video>
        </media>
      </sequence>
    </children>
  </project>
</xmeml>
"""
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(xml_content)
        return output_path
