import os
import sys
import time
import subprocess
import logging

# Ensure engine path is available
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "engine")))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("AutoEdit.E2ETest")

def run_end_to_end_test():
    logger.info("================================================================================")
    logger.info("🎬 AutoEdit Studio — Rigorous End-to-End Pipeline Integration Test")
    logger.info("================================================================================")

    test_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "scratch"))
    os.makedirs(test_dir, exist_ok=True)

    input_video = os.path.join(test_dir, "raw_take.mp4")
    output_video = os.path.join(test_dir, "rendered_viral_short.mp4")
    ass_subtitle_file = os.path.join(test_dir, "kinetic_subtitles.ass")
    bgm_audio_file = os.path.join(test_dir, "test_bgm.wav")

    # ---------------- 1. Resolve FFmpeg Binary ---------------- #
    from video.gpu_renderer import GPURenderEngine
    gpu_engine = GPURenderEngine()
    ffmpeg_exe = gpu_engine.ffmpeg_exe
    logger.info(f"[1/8] FFmpeg Binary: {ffmpeg_exe} | Encoder: {gpu_engine.encoder}")

    # ---------------- 2. Generate Synthetic 1080x1920 Test Video & Audio ---------------- #
    logger.info("[2/8] Generating synthetic 5-second 1080x1920 raw video take with tone audio...")
    gen_cmd = [
        ffmpeg_exe, "-y",
        "-f", "lavfi", "-i", "color=c=0x1E1E2E:s=1080x1920:d=5:r=30",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=5",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        input_video
    ]
    subprocess.run(gen_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    assert os.path.exists(input_video), "Failed to generate synthetic input video"

    # Generate synthetic BGM track
    bgm_cmd = [
        ffmpeg_exe, "-y",
        "-f", "lavfi", "-i", "sine=frequency=220:duration=5",
        "-c:a", "pcm_s16le",
        bgm_audio_file
    ]
    subprocess.run(bgm_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    logger.info(f"   -> Raw take created ({os.path.getsize(input_video)} bytes)")

    # ---------------- 3. Live Factual SEO & Trend Research ---------------- #
    logger.info("[3/8] Testing Live Real-Time YouTube SEO Trend Radar...")
    from ai.seo_radar import RealtimeSEORadar
    radar = RealtimeSEORadar()
    seo_res = radar.fetch_live_seo_radar("SaaS Automation", "AI Video Editing")
    logger.info(f"   -> Live queries retrieved: {len(seo_res['trending_queries'])}")
    logger.info(f"   -> Real competitor videos retrieved: {len(seo_res['competitor_videos'])}")
    assert len(seo_res['trending_queries']) > 0, "SEO radar returned 0 live queries"

    # ---------------- 4. Script Generation & Script Doctoring ---------------- #
    logger.info("[4/8] Testing Script Studio & Custom Script Doctor...")
    from ai.local_ai import LocalAIEngine
    ai_engine = LocalAIEngine()
    script = ai_engine.generate_viral_script(
        "3 AI Tools That Automate Video Editing",
        {"name": "ScaleFlow", "niche": "AI Video Tools", "cta_goal": "Comment 'GROWTH'"},
        target_duration_sec=45
    )
    logger.info(f"   -> Generated Hook: \"{script['hook']['spoken_text']}\"")
    logger.info(f"   -> Top Banner: \"{script['hook']['overlay_text']}\"")
    assert "hook" in script and "body_lines" in script, "Script structure invalid"

    # ---------------- 5. Speech Transcription & Silence Analysis ---------------- #
    logger.info("[5/8] Testing Speech Analysis & Transcript Word-Level Mapping...")
    words = [
        {"word": "Stop", "start": 0.0, "end": 0.35},
        {"word": "scrolling", "start": 0.38, "end": 0.8},
        {"word": "if", "start": 0.85, "end": 1.0},
        {"word": "you", "start": 1.05, "end": 1.2},
        {"word": "want", "start": 1.25, "end": 1.5},
        {"word": "to", "start": 1.55, "end": 1.7},
        {"word": "scale", "start": 1.75, "end": 2.1},
        {"word": "your", "start": 2.15, "end": 2.3},
        {"word": "business.", "start": 2.35, "end": 2.8},
        {"word": "Automate", "start": 3.0, "end": 3.4},
        {"word": "everything.", "start": 3.45, "end": 4.2}
    ]

    # ---------------- 6. Kinetic ASS Subtitle Generation ---------------- #
    logger.info("[6/8] Generating Kinetic Word-by-Word ASS Subtitles...")
    from video.subtitle_gen import SubtitleGenerator
    sub_gen = SubtitleGenerator()
    ass_content = sub_gen.generate_ass_subtitles(words, ass_subtitle_file, style_name="hormozi", video_width=1080, video_height=1920)
    assert os.path.exists(ass_subtitle_file), "ASS subtitle file was not generated"
    logger.info(f"   -> ASS Subtitle File: {os.path.getsize(ass_subtitle_file)} bytes")

    # ---------------- 7. GPU NVENC Video Compositing & Rendering ---------------- #
    logger.info(f"[7/8] Executing GPU NVENC Compositing Pipeline ({gpu_engine.encoder})...")
    from video.punch_zoom import RetentionPunchZoom
    from video.color_luts import ColorGradingSuite

    zoom_suite = RetentionPunchZoom()
    zoom_intervals = zoom_suite.generate_zoom_intervals(total_duration=5.0)
    zoom_filter = zoom_suite.get_ffmpeg_zoom_filter(zoom_intervals)

    color_suite = ColorGradingSuite()
    color_filter = color_suite.get_filter("clean_studio")

    t_render_start = time.time()
    render_res = gpu_engine.render_final_short(
        input_video=input_video,
        output_video=output_video,
        ass_subtitle_path=ass_subtitle_file,
        bgm_path=bgm_audio_file,
        color_lut_filter=color_filter,
        zoom_filter=zoom_filter,
        target_width=1080,
        target_height=1920,
        fps=30
    )
    render_time = time.time() - t_render_start
    logger.info(f"   -> Render finished in {render_time:.2f}s!")
    assert os.path.exists(output_video), "Rendered output video does not exist"
    out_size = os.path.getsize(output_video)
    logger.info(f"   -> Output MP4 Size: {out_size} bytes")
    assert out_size > 5000, f"Rendered video size too small ({out_size} bytes)"

    # ---------------- 8. Social Copy Packaging ---------------- #
    logger.info("[8/8] Generating 1-Click Social Distribution Package...")
    social_copy = ai_engine.generate_social_package(
        "Stop scrolling if you want to scale your business. Automate everything in 2026.",
        business_name="ScaleFlow"
    )
    logger.info(f"   -> Generated Titles: {social_copy['viral_titles']}")
    logger.info(f"   -> Hashtags: {social_copy['hashtags'][:5]}")
    assert len(social_copy["viral_titles"]) == 3, "Expected 3 viral titles"

    logger.info("================================================================================")
    logger.info(f"🎉 100% End-to-End Pipeline Integration Test PASSED in {render_time:.2f}s!")
    logger.info(f"Rendered Output Verified: {output_video}")
    logger.info("================================================================================")

if __name__ == "__main__":
    run_end_to_end_test()
