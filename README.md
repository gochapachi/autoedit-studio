# AutoEdit Studio — 100% Local AI Video Studio for Founders & Creators

A GPU-accelerated, privacy-first video studio that runs entirely on your PC. Research topics, write scripts, record with a teleprompter, and get an auto-edited vertical video with captions, B-roll, music, transitions and color grading — no cloud, no subscriptions, your data never leaves your machine.

> **Current stage: working beta.** The full pipeline (plan → record → polish → export, and one-click Quick Edit) runs end-to-end on Windows with NVIDIA GPU rendering (NVENC), local AI via Ollama, and AI B-roll generation via Wan2GP. Verified by an autonomous 10-test harness (`tests/agent_test_harness.py`, currently 10/10 green).

---

## What it does

### Two ways to make a video (choose on the home screen)

**1. Just edit my videos (Quick Edit)** — upload one or many video files and press one button. The AI agent then:
- Merges your uploads into one video
- Transcribes speech locally (faster-whisper)
- Cuts silences and filler words ("um", "uh")
- **Plans B-roll cutaways** — where they go, what each shows (chosen by your local LLM)
- Picks music mood, transition style, and color grade
- Renders on your NVIDIA GPU (NVENC) with animated captions on top

Before rendering, you get the full plan to review and tweak — and **the final say**:
- Tap transcript words to cut them yourself (overrides the auto cuts)
- Fix misheard subtitle text by hand, or let the AI proofread the transcript
- Add / remove / retime B-roll slots (including multiple custom slots)
- Swap any B-roll for your own video file
- Change music, transitions, captions, color look
- Download via a real Save-As dialog

**2. Make a video from scratch (Guided Studio)** — a simple 4-step wizard:
1. **Plan** — type a topic, see what people are actually searching (live YouTube data), get an AI-written script (editable cards: hook, lines, CTA), or paste your own notes and let the script doctor polish them. Optional YouTube channel audit.
2. **Record** — screen + camera bubble, camera-only, or screen-only. Live viewfinder, camera & mic pickers with level meter, 3-2-1 countdown, recording timer that keeps running when you switch apps (worker-driven frames), system-audio capture with status hints, and a built-in teleprompter (WPM speed control, full-screen practice mode).
3. **Polish** — tap words to cut, one-tap silence/filler removal, AI transcript fixing, caption styles, color looks, optional music.
4. **Create** — one click renders on your GPU with live progress, then download / go back and tweak anything.

### AI models — all local

| What | Engine | Notes |
|---|---|---|
| Scripts, research, edit plans, transcript fixing | **Ollama** (auto-started on demand) | Ships with `unsloth/Qwen3.5-9B` (fits 8GB VRAM) + smaller fallbacks. Model picker can search & install any Unsloth model live. |
| B-roll **video** generation | **Wan2GP** + LTX-2 (GGUF) | Local text-to-video in <8GB VRAM, minutes per clip |
| B-roll **image** generation | **Wan2GP** + Ideogram v4 / Krea 2 | Open-weight models running locally; images animated into Ken Burns cutaways |
| Motion cards (animated B-roll/overlay cards) | **Remotion** (bundled studio) | Spring-animated typography cards rendered to transparent WebM |
| Transcription | faster-whisper (int8) | Word-level timestamps, fully offline |
| Video encoding | NVIDIA NVENC (+ NVDEC decode) | 1080×1920 vertical exports, CPU fallback |

### Honest by design
No fabricated metrics, no fake success states. Every AI response carries a source badge (`AI` vs `Basic mode — start Ollama`), errors are shown in plain language, and research numbers come only from real sources (YouTube suggest API, yt-dlp).

---

## Quick start (Windows)

**Prerequisites:** Python 3.10+, Node.js 18+, an NVIDIA GPU (recommended), [Ollama for Windows](https://ollama.com/download) (optional but recommended — the app starts it automatically).

```bat
start_studio.bat
```

That's it — the launcher installs dependencies on first run and opens the desktop window (pywebview). Prefer a browser? Run the two services yourself:

```bash
# 1. Python GPU engine (FastAPI) — port 8000
python -m uvicorn api.server:app --app-dir engine --host 127.0.0.1 --port 8000

# 2. Next.js frontend — port 3000
cd app && npm install && npm run dev
```

Then open http://localhost:3000. The backend URL can be overridden with `NEXT_PUBLIC_API_BASE`.

### Optional extras

- **AI B-roll generation (Wan2GP):** install [Wan2GP](https://github.com/deepbeepmeep/Wan2GP) (default lookup path `D:\Wan2gp`, override with `AUTOEDIT_WGP_ROOT`). It provides local LTX-2 video and Ideogram v4 / Krea 2 image generation under 8GB VRAM.
- **Motion cards (Remotion):** `cd app/broll-studio && npm install` — first render downloads Remotion's headless Chromium once (~150MB).
- **Default AI model:** set `AUTOEDIT_OLLAMA_MODEL`, or pick from the in-app model picker (searches Unsloth's library live and installs with a progress bar).

---

## Project layout

```
app/                     Next.js 15 frontend
  src/components/        PlanStep, RecordStep, PolishStep, ExportStep, QuickEdit,
                         ModelPicker, TranscriptEditor, Teleprompter, ui…
  src/lib/api.ts         Single API client (typed) + Save-As download helper
  broll-studio/          Remotion motion-card studio (transparent WebM cards)
engine/                  Python FastAPI backend
  api/server.py          All REST + WebSocket endpoints
  ai/                    local_ai (Ollama), ollama_manager (auto-start/model search),
                         auto_editor (agentic edit plans), research/SEO, transcriber…
  video/                 gpu_renderer (NVENC + cuts + overlays + transitions),
                         broll (cinematic cards), motion_cards (Remotion),
                         wgp_provider (Wan2GP LTX/Ideogram/Krea), subtitles, LUTs…
tests/agent_test_harness.py   10-test autonomous verification harness
desktop_app.py           pywebview desktop shell
start_studio.bat         1-click Windows launcher
```

Full pipeline specs: see `ARCHITECTURE.md`. Agent/engineering guide: `AGENTS.md`.

## Verification

```bash
python tests/agent_test_harness.py --json-report tests/agent_harness_report.json
```

10 subsystem tests: hardware/NVENC, local AI engine, script doctor, YouTube audit, history store, subtitle/filter suite, REST endpoints, GPU render pipeline, Ollama manager, agentic quick-edit pipeline (plan + B-roll + transitions).

## Credits

- [Wan2GP](https://github.com/deepbeepmeep/Wan2GP) — low-VRAM local video/image generation (LTX-2, Ideogram v4, Krea 2)
- [Unsloth](https://unsloth.ai) — GGUF-quantized LLMs (Qwen3.5) via Ollama
- [Remotion](https://remotion.dev) — programmatic motion graphics for cards
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper), [yt-dlp](https://github.com/yt-dlp/yt-dlp), FFmpeg (NVENC/NVDEC)
