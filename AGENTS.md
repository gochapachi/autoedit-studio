# 🤖 AutoEdit Studio — AI Agent Operating Manual & Engineering Guide

> **For AI Coding Assistants & Autonomous Agents**: This document is your primary source of truth for understanding, modifying, testing, and extending the AutoEdit Studio codebase.

---

## 🎯 System Mission & Constraints

AutoEdit Studio is a **production-grade, 100% local, GPU-accelerated video automation engine** for content creators and founders.

### 🛡️ Non-Negotiable Operational Constraints

1. **100% Local AI (Zero Cloud / Zero External API Dependencies)**:
   - All text generation, SEO research, script doctoring, and transcription MUST run on-device.
   - Use local Ollama (`http://127.0.0.1:11434`) or the built-in deterministic offline heuristics engine (`engine/ai/local_ai.py`).
   - NEVER add required cloud API keys (e.g. Gemini, OpenAI, Anthropic) as blocking dependencies.

2. **Strict <4GB VRAM Memory Cap**:
   - Models run sequentially, never concurrently in VRAM.
   - Faster-Whisper runs in `int8` quantization (~1.8GB VRAM).
   - Silero-VAD runs via TorchScript (~80MB VRAM).
   - Video encoding is hardware-offloaded to NVIDIA NVENC ASIC (0 MB CUDA memory).

3. **Coolify & VPS Compatibility**:
   - The user's production server is Ubuntu 24.04 managed via Coolify (`https://server.anagataitsolutions.in`).
   - Ensure all backend engines, Dockerfiles, and dependencies remain compatible with headless Linux + Docker.

---

## 🏗️ Repository Architecture & File Taxonomy

```
AutoEdit-Studio/
├── app/                          # Next.js 15 / React 19 Frontend UI
│   ├── src/
│   │   ├── components/           # Core UI Components
│   │   │   ├── BrandBrain.tsx    # Brand persona intake, local model picker, YouTube auto-fill
│   │   │   ├── ResearchHub.tsx   # Local SEO trend discovery & YouTube channel deep audit
│   │   │   ├── ScriptGen.tsx     # Dual-mode script generator & custom script doctor refiner
│   │   │   ├── HistoryDrawer.tsx # Persistent state/history slide-over drawer
│   │   │   ├── Teleprompter.tsx  # Floating webcam teleprompter with auto-scroll & cues
│   │   │   ├── SimpleStudio.tsx  # Text-based transcript cutting (Notion-style)
│   │   │   ├── VideoPlayer.tsx   # Live 9:16 video player with active kinetic captions
│   │   │   ├── StylePresets.tsx  # Subtitle presets (Hormozi, MrBeast, Minimalist, Cyberpunk)
│   │   │   ├── BGMSelector.tsx   # YouTube/preset music fetcher with beat detection
│   │   │   ├── AICopilot.tsx     # Quick chat assistant
│   │   │   ├── SocialCopy.tsx    # 3 viral titles, description, timestamps, hashtags
│   │   │   └── ExportModal.tsx   # NVENC hardware export dialog
│   │   └── app/                  # Main Page & Layout (`page.tsx`)
│   └── package.json
│
├── engine/                       # Python FastAPI Local Engine Backend
│   ├── ai/                       # Local AI & Speech Intelligence
│   │   ├── local_ai.py           # Ollama connector & built-in offline NLP/script doctor
│   │   ├── youtube_research.py   # Local yt-dlp channel metadata & strategy extractor
│   │   ├── transcriber.py        # faster-whisper INT8 word-level transcriber
│   │   ├── vad_silence.py        # Silero-VAD pause & silence trimmer (<0.35s gaps)
│   │   ├── script_aligner.py     # Matches spoken audio takes against script lines
│   │   ├── take_selector.py      # Selects highest-confidence take & purges filler words
│   │   ├── face_tracker.py       # OpenCV/MediaPipe 9:16 active speaker reframing
│   │   └── voice_master.py       # -14 LUFS studio audio compressor & EQ
│   │
│   ├── audio/                    # Music, Beats & SFX
│   │   ├── ytdlp_fetcher.py      # yt-dlp audio downloader & converter
│   │   ├── beat_detector.py      # Librosa beat tracking & tempo analysis
│   │   └── sfx_ducking.py        # SFX placement & vocal sidechain auto-ducking
│   │
│   ├── video/                    # Video Compositing & GPU Export
│   │   ├── subtitle_gen.py       # ASS word-by-word karaoke subtitle generator
│   │   ├── punch_zoom.py         # 1.15x rhythmic retention zoom intervals
│   │   ├── hook_banner.py        # 3-second top hook overlay banner filter
│   │   ├── color_luts.py         # 1-Click color grading presets
│   │   └── gpu_renderer.py       # Hardware-accelerated NVIDIA NVENC 60fps exporter
│   │
│   ├── storage/                  # Persistent State Stores
│   │   ├── history_store.py      # Persistent JSON CRUD store for topics, scripts, audits
│   │   └── history.json          # Historical data file
│   │
│   ├── api/server.py             # FastAPI REST daemon & WebSocket progress endpoints
│   ├── requirements.txt          # Python dependencies
│   └── brand_profile.json        # Active brand profile state
│
├── tests/                        # Autonomous AI Agent Test Harness
│   ├── agent_test_harness.py     # 1-Command validation harness for all 7 subsystems
│   └── agent_harness_report.json # Diagnostic JSON report output
│
├── start_studio.bat              # 1-Click Windows Native Launcher
├── AGENTS.md                     # This file (AI Agent operating manual)
├── ARCHITECTURE.md               # Deep technical pipeline specifications
└── README.md                     # Product & User Documentation
```

---

## ⚡ Agent Test & Verification Harness

Before making any commit or concluding your turn, you **MUST** run the autonomous agent test harness:

```bash
python tests/agent_test_harness.py --json-report tests/agent_harness_report.json
```

### What the Harness Tests:
1. **Hardware & GPU Environment**: Verifies CUDA availability, NVENC detection, and CPU fallbacks.
2. **Local AI Engine**: Tests keyword trend generation and retention script creation.
3. **Custom Script Doctor Refiner**: Validates raw notes parsing into structured 30s/45s/60s retention scripts.
4. **YouTube Channel Intelligence**: Tests `yt-dlp` metadata extraction and business strategy auditing.
5. **Stateful History Store**: Tests CRUD operations, favorites, deduplication, and persistence.
6. **Subtitle & Video Filters**: Tests ASS subtitle styling, zoom filters, hook banner text, and color LUTs.
7. **FastAPI Endpoints**: Validates REST routing, payloads, and response codes.

---

## 🛠️ Developer Recipes for Common Extensions

### Recipe 1: Adding a New Subtitle Preset Style
1. Open [`engine/video/subtitle_gen.py`](file:///e:/Anagata%20Video%20Editor%20for%20founders/engine/video/subtitle_gen.py).
2. Add your style config to `PRESET_STYLES`:
   ```python
   "cyberpunk_glitch": {
       "fontname": "Orbitron",
       "fontsize": 26,
       "primary_color": "&H00FFFF00", # Cyan
       "active_color": "&H00FF00FF",  # Magenta
       "outline_color": "&H00000000",
       "outline_width": 4.5,
       "shadow": 3.0,
       "bold": 1,
       "all_caps": True
   }
   ```
3. Update [`app/src/components/StylePresets.tsx`](file:///e:/Anagata%20Video%20Editor%20for%20founders/app/src/components/StylePresets.tsx) with the new preset card.
4. Run `python tests/agent_test_harness.py` to verify ASS generation.

### Recipe 2: Adding a New Local AI Prompting Strategy
1. Open [`engine/ai/local_ai.py`](file:///e:/Anagata%20Video%20Editor%20for%20founders/engine/ai/local_ai.py).
2. Implement your method adhering to:
   - Local Ollama prompt with structured JSON formatting instructions.
   - Built-in fallback heuristics to guarantee 100% offline uptime without crashing if an LLM is offline.
3. Expose the endpoint in [`engine/api/server.py`](file:///e:/Anagata%20Video%20Editor%20for%20founders/engine/api/server.py).
4. Add a test case in [`tests/agent_test_harness.py`](file:///e:/Anagata%20Video%20Editor%20for%20founders/tests/agent_test_harness.py).

### Recipe 3: Extending History Persistence
1. Open [`engine/storage/history_store.py`](file:///e:/Anagata%20Video%20Editor%20for%20founders/engine/storage/history_store.py).
2. Add your category or schema fields (e.g. `saved_brolls`, `custom_prompts`).
3. Ensure atomic file writes and schema migration fallbacks in `_ensure_file()`.
4. Update [`app/src/components/HistoryDrawer.tsx`](file:///e:/Anagata%20Video%20Editor%20for%20founders/app/src/components/HistoryDrawer.tsx).

---

## 🚀 Running the Stack Locally

```bash
# 1. Start Python GPU Engine (FastAPI) on port 8000
python -m uvicorn api.server:app --app-dir engine --host 127.0.0.1 --port 8000 --reload

# 2. Start Next.js Frontend on port 3000
cd app && npm run dev

# 3. Windows 1-Click Native Launcher
start_studio.bat
```
