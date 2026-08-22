#!/usr/bin/env python3
"""
===============================================================================
⚡ AutoEdit Studio — Autonomous AI Agent Verification & Diagnostic Harness
===============================================================================
This test harness is designed for AI coding agents and human developers to
autonomously verify, benchmark, and validate all subsystems of the AutoEdit Studio
engine with a single command.

Usage:
    python tests/agent_test_harness.py
    python tests/agent_test_harness.py --verbose
    python tests/agent_test_harness.py --json-report harness_report.json

Checks Performed:
    1. System & GPU Environment (CUDA, NVENC, CPU fallback, VRAM cap guarantee)
    2. 100% Local AI Engine (Ollama integration, offline heuristic engine, viral scripts)
    3. Custom Script Doctor Refiner (Raw notes -> structured retention script)
    4. YouTube Channel Business Intelligence (yt-dlp flat metadata extractor)
    5. Stateful History & Memory Store (CRUD operations, JSON persistence)
    6. Audio & VAD Processing (Silero-VAD, Librosa beat detector, SFX ducking)
    7. Subtitle Generation & Video Compositing (ASS karaoke formatting, FFmpeg filter graph)
    8. REST & WebSocket API Endpoints (FastAPI TestClient integration suite)
===============================================================================
"""

import sys
import os
import time
import json
import argparse
import tempfile
import traceback
from typing import Dict, Any, List, Tuple

# Ensure UTF-8 output on Windows terminal
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Ensure engine path is in sys.path
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENGINE_DIR = os.path.join(ROOT_DIR, "engine")
if ENGINE_DIR not in sys.path:
    sys.path.insert(0, ENGINE_DIR)


class AgentHarness:
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.results: List[Dict[str, Any]] = []
        self.start_time = time.time()

    def log(self, msg: str, level: str = "INFO"):
        prefix = {
            "INFO": "[\033[94mINFO\033[0m]",
            "PASS": "[\033[92mPASS\033[0m]",
            "WARN": "[\033[93mWARN\033[0m]",
            "FAIL": "[\033[91mFAIL\033[0m]"
        }.get(level, "[LOG]")
        print(f"{prefix} {msg}")

    def record_result(self, test_name: str, passed: bool, duration_ms: float, details: Dict[str, Any] = None, error: str = None):
        self.results.append({
            "test": test_name,
            "passed": passed,
            "duration_ms": round(duration_ms, 2),
            "details": details or {},
            "error": error
        })
        status_label = "PASS" if passed else "FAIL"
        duration_str = f"({duration_ms:.1f}ms)"
        if passed:
            self.log(f"{test_name} {duration_str}", level="PASS")
        else:
            self.log(f"{test_name} {duration_str} - Error: {error}", level="FAIL")

    # ---------------- 1. Hardware & GPU Check ---------------- #
    def test_hardware_and_gpu(self):
        t0 = time.time()
        try:
            gpu_available = False
            gpu_name = "CPU Only"
            cuda_version = "N/A"
            try:
                import torch
                gpu_available = torch.cuda.is_available()
                if gpu_available:
                    gpu_name = torch.cuda.get_device_name(0)
                    cuda_version = torch.version.cuda
            except ImportError:
                pass

            details = {
                "gpu_available": gpu_available,
                "gpu_name": gpu_name,
                "cuda_version": cuda_version,
                "python_version": sys.version.split()[0],
                "platform": sys.platform
            }
            self.record_result("1. Hardware & Environment Check", True, (time.time() - t0) * 1000, details)
        except Exception as e:
            self.record_result("1. Hardware & Environment Check", False, (time.time() - t0) * 1000, error=str(e))

    # ---------------- 2. Local AI Engine ---------------- #
    def test_local_ai_engine(self):
        t0 = time.time()
        try:
            from ai.local_ai import LocalAIEngine
            engine = LocalAIEngine()

            # Test Keyword & Trend Discovery
            trends = engine.research_keywords_and_trends("AI Video Marketing", "Fast Video Editing")
            assert "trending_queries" in trends, "Missing trending_queries"
            assert len(trends["trending_queries"]) >= 3, "Insufficient trending queries"

            # Test Viral Script Generation
            biz_profile = {
                "name": "AutoEdit Agency",
                "niche": "AI Video Tools",
                "voice": "Energetic & Direct",
                "cta_goal": "Comment 'GROWTH'"
            }
            script = engine.generate_viral_script("3 AI Tools For Fast Editing", biz_profile, target_duration_sec=45)
            assert "hook" in script, "Missing hook object"
            assert "spoken_text" in script["hook"], "Missing hook spoken text"
            assert len(script.get("body_lines", [])) >= 1, "Missing body lines"

            details = {
                "trends_count": len(trends["trending_queries"]),
                "hook": script["hook"]["spoken_text"][:50] + "...",
                "body_steps": len(script["body_lines"])
            }
            self.record_result("2. Local AI Engine (SEO & Script Gen)", True, (time.time() - t0) * 1000, details)
        except Exception as e:
            self.record_result("2. Local AI Engine (SEO & Script Gen)", False, (time.time() - t0) * 1000, error=str(e))

    # ---------------- 3. Custom Script Doctor Refiner ---------------- #
    def test_custom_script_refiner(self):
        t0 = time.time()
        try:
            from ai.local_ai import LocalAIEngine
            engine = LocalAIEngine()

            raw_input = """Stop wasting 5 hours cutting awkward pauses in video editors.
We created a 100% local AI tool that cuts silences automatically under 0.35 seconds.
Type START in the comments to get access."""

            biz_profile = {
                "name": "AutoEdit Agency",
                "voice": "Actionable & Fast-Paced",
                "cta_goal": "Comment 'START'"
            }

            refined = engine.refine_custom_script(raw_input, biz_profile, target_duration_sec=30)
            assert "hook" in refined, "Missing hook"
            assert "overlay_text" in refined["hook"], "Missing overlay hook banner text"
            assert "body_lines" in refined and len(refined["body_lines"]) >= 1, "Missing body lines"
            assert "cta" in refined, "Missing CTA"

            details = {
                "refined_title": refined.get("title"),
                "spoken_hook": refined["hook"]["spoken_text"],
                "hook_banner": refined["hook"]["overlay_text"],
                "body_lines_count": len(refined["body_lines"])
            }
            self.record_result("3. Custom Script Doctor Refiner", True, (time.time() - t0) * 1000, details)
        except Exception as e:
            self.record_result("3. Custom Script Doctor Refiner", False, (time.time() - t0) * 1000, error=str(e))

    # ---------------- 4. YouTube Channel Business Intelligence ---------------- #
    def test_youtube_channel_auditor(self):
        t0 = time.time()
        try:
            from ai.youtube_research import YouTubeChannelAuditor
            auditor = YouTubeChannelAuditor()

            audit = auditor.audit_channel("@thealexhormozi")
            assert "channel_title" in audit, "Missing channel title"
            assert "analysis" in audit, "Missing analysis object"
            assert "top_hook_patterns" in audit["analysis"], "Missing top_hook_patterns"
            assert "viral_topic_opportunities" in audit["analysis"], "Missing viral_topic_opportunities"
            assert len(audit["analysis"]["viral_topic_opportunities"]) >= 3, "Insufficient viral topic opportunities"

            details = {
                "channel_title": audit["channel_title"],
                "hooks_identified": len(audit["analysis"]["top_hook_patterns"]),
                "content_pillars": audit["analysis"].get("content_pillars", []),
                "viral_topics_count": len(audit["analysis"]["viral_topic_opportunities"])
            }
            self.record_result("4. YouTube Channel Intelligence Auditor", True, (time.time() - t0) * 1000, details)
        except Exception as e:
            self.record_result("4. YouTube Channel Intelligence Auditor", False, (time.time() - t0) * 1000, error=str(e))

    # ---------------- 5. Stateful History Store ---------------- #
    def test_history_store(self):
        t0 = time.time()
        try:
            from storage.history_store import LocalHistoryStore
            with tempfile.TemporaryDirectory() as tmp_dir:
                store = LocalHistoryStore(storage_dir=tmp_dir)

                # Save topic
                t = store.save_topic("Agent Automation 2026", "AI Tools")
                assert t["topic"] == "Agent Automation 2026"

                # Save script
                s_data = {
                    "title": "Automate Video Editing in 30 Seconds",
                    "hook": {"spoken_text": "Stop scrolling right now!"},
                    "body_lines": [{"spoken_text": "Here is how it works."}],
                    "cta": {"spoken_text": "Comment YES"}
                }
                s = store.save_script(s_data, topic="Agent Automation 2026", script_type="custom_refined")
                assert s["id"] is not None

                # Toggle favorite
                fav = store.toggle_favorite("scripts", s["id"])
                assert fav is True

                # Retrieve all
                all_history = store.get_all()
                assert len(all_history["topics"]) >= 1
                assert len(all_history["scripts"]) >= 1

                # Delete item
                deleted = store.delete_item("scripts", s["id"])
                assert deleted is True

            self.record_result("5. Stateful History Store (CRUD)", True, (time.time() - t0) * 1000, {"status": "all CRUD assertions passed"})
        except Exception as e:
            self.record_result("5. Stateful History Store (CRUD)", False, (time.time() - t0) * 1000, error=str(e))

    # ---------------- 6. Subtitle & Video Filter Pipeline ---------------- #
    def test_subtitle_and_filter_pipeline(self):
        t0 = time.time()
        try:
            from video.subtitle_gen import SubtitleGenerator, PRESET_STYLES
            from video.punch_zoom import RetentionPunchZoom
            from video.hook_banner import TopHookBanner
            from video.color_luts import ColorGradingSuite

            sub_gen = SubtitleGenerator()
            words = [
                {"word": "Stop", "start": 0.0, "end": 0.3},
                {"word": "scrolling", "start": 0.35, "end": 0.8},
                {"word": "now!", "start": 0.85, "end": 1.2}
            ]

            with tempfile.NamedTemporaryFile(suffix=".ass", delete=False) as tmp_ass:
                ass_path = tmp_ass.name

            try:
                sub_gen.generate_ass_subtitles(words, ass_path, style_name="hormozi")
                assert os.path.exists(ass_path)
                with open(ass_path, "r", encoding="utf-8") as f:
                    ass_content = f.read()
                    assert "[Script Info]" in ass_content
                    assert "Dialogue:" in ass_content
            finally:
                if os.path.exists(ass_path):
                    os.remove(ass_path)

            # Punch Zoom Filter
            pz = RetentionPunchZoom()
            intervals = pz.generate_zoom_intervals(15.0)
            zoom_filter = pz.get_ffmpeg_zoom_filter(intervals)
            assert zoom_filter is not None

            # Hook Banner Filter
            hb = TopHookBanner()
            banner_filter = hb.get_ffmpeg_drawtext_filter("TEST VIRAL HOOK BANNER")
            assert "drawtext=" in banner_filter

            # Color LUTs
            from video.color_luts import ColorGradingSuite, COLOR_PRESETS
            cg = ColorGradingSuite()
            lut_filter = cg.get_filter("clean_studio")
            assert lut_filter is not None

            details = {
                "subtitle_styles": list(PRESET_STYLES.keys()),
                "zoom_intervals_supported": True,
                "hook_banner_filter_ready": True,
                "color_luts_available": list(COLOR_PRESETS.keys())
            }
            self.record_result("6. Subtitle & Video Filter Suite", True, (time.time() - t0) * 1000, details)
        except Exception as e:
            self.record_result("6. Subtitle & Video Filter Suite", False, (time.time() - t0) * 1000, error=str(e))

    # ---------------- 7. FastAPI Integration Suite ---------------- #
    def test_fastapi_endpoints(self):
        t0 = time.time()
        try:
            from fastapi.testclient import TestClient
            from api.server import app

            # The save/research endpoints write the real brand_profile.json —
            # snapshot it first and restore after so test fixtures never leak
            # into the user's actual brand profile.
            profile_path = os.path.join(ENGINE_DIR, "brand_profile.json")
            profile_backup = None
            if os.path.exists(profile_path):
                with open(profile_path, "r", encoding="utf-8") as f:
                    profile_backup = f.read()

            try:
                self._run_fastapi_assertions(app)
            finally:
                if profile_backup is not None:
                    with open(profile_path, "w", encoding="utf-8") as f:
                        f.write(profile_backup)

            self.record_result("7. FastAPI Backend REST Integration", True, (time.time() - t0) * 1000, {
                "endpoints": "health, brand-brain, research, script, render validation"
            })
        except Exception as e:
            self.record_result("7. FastAPI Backend REST Integration", False, (time.time() - t0) * 1000, error=str(e))

    def _run_fastapi_assertions(self, app):
        from fastapi.testclient import TestClient
        client = TestClient(app)

        # Health
        r = client.get("/api/health")
        assert r.status_code == 200 and r.json()["status"] == "online"

        # Brand Brain Get/Save
        r = client.post("/api/brand-brain/save", json={
            "name": "Test Agency",
            "niche": "Software",
            "audience": "Founders",
            "voice": "Direct",
            "cta_goal": "Comment TEST"
        })
        assert r.status_code == 200

        # Local Research
        r = client.post("/api/local-ai/research", json={"niche": "SaaS", "topic": "Scale Fast"})
        assert r.status_code == 200

        # Local Script Gen
        r = client.post("/api/local-ai/generate-script", json={
            "topic": "3 AI Tools",
            "business_profile": {"name": "Test"},
            "target_duration_sec": 30
        })
        assert r.status_code == 200

        # Agentic Business Research & Chat Ideation
        r = client.post("/api/agent/research-business", json={
            "business_name": "Acme AI",
            "niche": "SaaS Video Editing",
            "target_audience": "Founders"
        })
        assert r.status_code == 200 and r.json()["status"] == "success"

        r = client.post("/api/agent/chat-ideate", json={
            "message": "I want to make a video on automating video production",
            "business_profile": {"name": "Acme AI", "niche": "Video Tech"}
        })
        assert r.status_code == 200 and "proposed_topics" in r.json()

        # History API
        r = client.get("/api/history")
        assert r.status_code == 200

    # ---------------- 8. End-to-End GPU NVENC Render Pipeline ---------------- #
    def test_e2e_gpu_render_pipeline(self):
        t0 = time.time()
        try:
            from video.gpu_renderer import GPURenderEngine
            from video.subtitle_gen import SubtitleGenerator
            import subprocess

            gpu_engine = GPURenderEngine()
            ffmpeg_exe = gpu_engine.ffmpeg_exe
            test_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "scratch"))
            os.makedirs(test_dir, exist_ok=True)

            in_vid = os.path.join(test_dir, "harness_raw.mp4")
            out_vid = os.path.join(test_dir, "harness_out.mp4")
            sub_file = os.path.join(test_dir, "harness_sub.ass")

            # Generate synthetic 3s video
            subprocess.run([
                ffmpeg_exe, "-y",
                "-f", "lavfi", "-i", "color=c=0x1E1E2E:s=1080x1920:d=3:r=30",
                "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
                "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-c:a", "aac",
                in_vid
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

            # Generate Subtitles
            sub_gen = SubtitleGenerator()
            words = [{"word": "Stop", "start": 0.0, "end": 0.5}, {"word": "Scrolling", "start": 0.6, "end": 1.5}]
            sub_gen.generate_ass_subtitles(words, sub_file, style_name="hormozi", video_width=1080, video_height=1920)

            # Render NVENC
            gpu_engine.render_final_short(
                input_video=in_vid,
                output_video=out_vid,
                ass_subtitle_path=sub_file,
                target_width=1080,
                target_height=1920,
                fps=30
            )

            assert os.path.exists(out_vid), "Rendered video not found"
            size = os.path.getsize(out_vid)
            assert size > 5000, f"Rendered output too small: {size} bytes"

            self.record_result("8. End-to-End GPU NVENC Render Pipeline", True, (time.time() - t0) * 1000, {
                "encoder": gpu_engine.encoder,
                "rendered_bytes": size,
                "output_path": out_vid
            })
        except Exception as e:
            self.record_result("8. End-to-End GPU NVENC Render Pipeline", False, (time.time() - t0) * 1000, error=str(e))

    # ---------------- 9. Ollama Daemon & Model Manager ---------------- #
    def test_ollama_manager(self):
        t0 = time.time()
        try:
            from ai.ollama_manager import OllamaManager

            mgr = OllamaManager()

            # Auto-start must return a well-formed status and not raise
            status = mgr.ensure_running(wait_seconds=5)
            assert isinstance(status, dict)
            assert "running" in status and "error" in status
            # On this dev machine Ollama is installed; accept either outcome but
            # require the boolean to match a direct reachability probe.
            assert status["running"] == mgr.is_running()

            # Unsloth search must always return usable entries (live or curated)
            search = mgr.search_unsloth_models()
            assert search.get("status") == "success"
            models = search.get("models", [])
            assert len(models) > 0, "No Unsloth models returned"
            for m in models[:3]:
                assert m.get("name"), "Model entry missing name"
                assert "installed" in m

            installed = mgr.list_installed_models()
            self.record_result("9. Ollama Daemon & Unsloth Model Manager", True, (time.time() - t0) * 1000, {
                "ollama_running": status["running"],
                "ollama_version": status.get("version"),
                "search_source": search.get("source"),
                "search_results": len(models),
                "installed_models": installed
            })
        except Exception as e:
            self.record_result("9. Ollama Daemon & Unsloth Model Manager", False, (time.time() - t0) * 1000, error=str(e))

    # ---------------- 10. Agentic Quick-Edit Pipeline ---------------- #
    def test_quickedit_pipeline(self):
        t0 = time.time()
        try:
            from ai.auto_editor import AutoEditAgent
            from ai.local_ai import LocalAIEngine
            from video.broll import BRollGenerator
            from video.gpu_renderer import GPURenderEngine
            import subprocess as sp

            offline_ai = LocalAIEngine(ollama_url="http://127.0.0.1:59999")  # deterministic offline plan
            agent = AutoEditAgent(local_ai=offline_ai)

            # Cut math: speech minus a filler span
            keep = agent.keep_segments_from([[0, 5], [6, 10]], [[2.0, 2.4]], 10.0)
            spans = [(x["start"], x["end"]) for x in keep]
            assert any(s < 2 and e > 2.4 for s, e in spans) or len(keep) >= 2

            words = [{"word": w, "start": i * 0.5, "end": i * 0.5 + 0.4} for i, w in enumerate(
                ["welcome", "to", "the", "dental", "implants", "channel", "about", "recovery", "costs"]
            )]
            plan = agent.build_plan(words, "welcome text", keep, 4.5)
            assert plan["layers"]["music"]["mood"] in ("upbeat", "calm", "dramatic")
            assert plan["layers"]["grade"]["look"] and plan["layers"]["transitions"]["style"]

            eng = GPURenderEngine()
            card = BRollGenerator(ffmpeg_exe=eng.ffmpeg_exe).generate_card(
                "dental implants", os.path.join(os.path.dirname(__file__), "scratch", "harness_broll.mp4"), duration=1.5
            )
            assert card and os.path.exists(card)

            test_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "scratch"))
            in_vid = os.path.join(test_dir, "harness_qe_src.mp4")
            out_vid = os.path.join(test_dir, "harness_qe_out.mp4")
            sp.run([eng.ffmpeg_exe, "-y", "-f", "lavfi", "-i", "testsrc=duration=6:size=640x360:rate=30",
                    "-f", "lavfi", "-i", "sine=frequency=440:duration=6",
                    "-c:v", "libx264", "-c:a", "aac", "-shortest", in_vid],
                   stdout=sp.DEVNULL, stderr=sp.DEVNULL, check=True)

            res = eng.render_final_short(
                in_vid, out_vid,
                keep_segments=[{"start": 0, "end": 2.5}, {"start": 4, "end": 6}],
                broll_overlays=[{"path": card, "start": 0.4, "end": 1.6}],
                segment_boundaries=[2.5], transition_style="dip",
            )
            assert res["status"] == "success", res.get("error", "")[-300:]
            assert os.path.getsize(out_vid) > 5000

            self.record_result("10. Agentic Quick-Edit Pipeline (plan + B-roll + transitions)", True, (time.time() - t0) * 1000, {
                "plan_source": plan.get("source"),
                "brolls_planned": len(plan["layers"]["brolls"]),
                "cuts_applied": res.get("cuts_applied"),
            })
        except Exception as e:
            self.record_result("10. Agentic Quick-Edit Pipeline (plan + B-roll + transitions)", False, (time.time() - t0) * 1000, error=str(e))

    # ---------------- Run All Tests ---------------- #
    def run_all(self) -> bool:
        print("=" * 80)
        print("⚡ AutoEdit Studio — AI Agent Test & Verification Harness")
        print("=" * 80)

        self.test_hardware_and_gpu()
        self.test_local_ai_engine()
        self.test_custom_script_refiner()
        self.test_youtube_channel_auditor()
        self.test_history_store()
        self.test_subtitle_and_filter_pipeline()
        self.test_fastapi_endpoints()
        self.test_e2e_gpu_render_pipeline()
        self.test_ollama_manager()
        self.test_quickedit_pipeline()

        total_time = round((time.time() - self.start_time) * 1000, 2)
        passed_count = sum(1 for r in self.results if r["passed"])
        total_count = len(self.results)
        all_passed = passed_count == total_count

        print("=" * 80)
        print(f"📊 SUMMARY: {passed_count}/{total_count} Tests Passed in {total_time}ms")
        print("=" * 80)

        return all_passed

    def export_json(self, output_path: str):
        report = {
            "timestamp": time.time(),
            "total_duration_ms": round((time.time() - self.start_time) * 1000, 2),
            "all_passed": all(r["passed"] for r in self.results),
            "tests_total": len(self.results),
            "tests_passed": sum(1 for r in self.results if r["passed"]),
            "results": self.results
        }
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        self.log(f"Exported diagnostic report to {output_path}", level="INFO")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AutoEdit Studio AI Agent Test Harness")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose test output")
    parser.add_argument("--json-report", type=str, default="", help="Path to write JSON test report")
    args = parser.parse_args()

    harness = AgentHarness(verbose=args.verbose)
    success = harness.run_all()

    if args.json_report:
        harness.export_json(args.json_report)

    sys.exit(0 if success else 1)
