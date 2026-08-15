# ⚡ AutoEdit Studio — Native Windows AI Video Automation Engine

> **Production-Grade, 100% Local GPU-Accelerated Video Editor for Windows.** Transform raw multi-take footage and long videos into viral, high-retention Reels, Shorts, and TikToks in under 60 seconds with **zero manual cutting**, **<4GB VRAM footprint**, and **Gemini-powered content strategy**.

---

## 🌟 The 4-Stage Full-Funnel Content Engine

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  STAGE 1: STRATEGY & SCRIPT ───> STAGE 2: TELEPROMPTER & RECORD ───> STAGE 3: DROP & AUTO-EDIT ───> STAGE 4: PUBLISH   │
│  • Brand Brain Profile           • Floating Desktop Prompter         • Script-to-Take Matcher       • ~6s NVENC Render │
│  • Gemini Keyword/SEO Discovery  • Adjustable Auto-Scroll & Pacing   • 1-Click Silence & Filler Cut • 1-Click Social Copy│
│  • 1-Click Viral Script Pack     • Pacing & Visual Cues              • Kinetic Subtitles & BGM Beat • Multi-Format Exporter│
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Features

### 🧠 1. Business Strategy & Gemini SEO Research
- **Brand Brain**: Save your business niche, target audience, brand voice, and core offer once. All AI scripts and styling adapt automatically.
- **Gemini Keyword & Trend Discovery**: Finds high-demand, low-competition search queries and analyzes competitor hook angles for YouTube Shorts and TikTok.
- **Viral Script Generator**: Generates 30-60s retention scripts with scroll-stopping 3-second hooks, body points with visual/SFX cues (`[Action: Point to screen]`), and high-converting CTAs.
- **Desktop Teleprompter**: Clean, translucent floating prompter with auto-scroll and color-coded pacing cues.

### 🎙️ 2. Local Speech AI & Smart Cutting (<4GB VRAM Cap)
- **Word-Level Whisper AI**: Fast local transcription using `faster-whisper` (INT8 quantized, ~1.8GB VRAM).
- **Silero-VAD Silence Cutter**: Removes awkward pauses (>0.35s) and compresses gaps into natural conversational flow.
- **Filler Word Purger**: Automatically detects and excises "um", "uh", "aahh", "like", and heavy breaths.
- **Script-to-Take Matcher**: Automatically matches recorded takes against your generated script and selects the highest quality delivery (`Take 2 ⭐ Best`).
- **Studio Voice Mastering**: Built-in equalizer, compressor, and noise gate for broadcast-quality audio (-14 LUFS standard).

### ✍️ 3. Kinetic Subtitles, Visual Overlays & B-Roll
- **Word-by-Word Active Karaoke Captions**: Synchronized active bounce, glow, and color shifting.
- **Trending Style Presets**: *Alex Hormozi, MrBeast, Luxury Minimalist, Cyberpunk Neon*.
- **Auto-Emoji & Keyword Accents**: Maps emotional words to animated bouncing emojis (💰, 🚀, 🔥, ❌, ⚠️).
- **Top Hook Headline Banner**: 3-second curiosity headline across the top of the video to stop scrollers.
- **AI Smart 9:16 Reframe & Face Tracking**: Smoothly pans and centers the active speaker in vertical format.

### 🎵 4. Smart BGM, Beat Sync & Sound Effects
- **`yt-dlp` Music Downloader**: Paste any YouTube / SoundCloud link or search by mood (*Lo-Fi Chill, Cyber Trap, Hype Workout, Cinematic Warmth*).
- **Beat-Grid & Drop Alignment**: Librosa beat tracking snaps video cuts and text animations to musical downbeats.
- **Intelligent Auto-Ducking (Vocal Sidechain)**: Drops BGM volume to -18dB during dialogue and smoothly swells during pauses.
- **Crisp SFX Generator**: Auto-placed whooshes on zoom cuts, pops on captions, and risers in hooks.

### ⚡ 5. Hardware NVENC GPU Rendering & Pro UI
- **Sub-10s Rendering**: NVIDIA NVENC (`h264_nvenc`) exports 1080x1920 60fps MP4 in **~6 to 8 seconds**.
- **Dual Experience Modes**:
  - *Simple Studio Mode*: Read and edit video like a Notion document + WYSIWYG draggable canvas.
  - *Pro Timeline Mode*: Multi-track waveforms, retention drop-off heatmaps, and frame scrubbing.
- **1-Click Social Packaging**: Instant copy for 3 high-CTR titles, SEO description with timestamp chapters, and viral hashtags.

---

## 🛡️ 8GB VRAM Safeguard Architecture

| Component | Technology | Memory Footprint |
| :--- | :--- | :--- |
| **Speech-To-Text** | `faster-whisper` (INT8 quantized) | **~1.8 GB VRAM** |
| **Voice Activity / Silence** | `Silero-VAD` (TorchScript) | **~80 MB VRAM** |
| **Face Tracking & Reframe** | OpenCV + MediaPipe | **~200 MB VRAM** |
| **Video Encoding** | NVIDIA NVENC Hardware ASIC | **Dedicated Hardware (0 MB CUDA VRAM)** |
| **Total Peak Usage** | **Sequential Model Lifecycle** | **< 3.5 GB VRAM** |

---

## 📦 Project Structure

```
AutoEdit-Studio/
├── app/                          # Modern Next.js / React 19 Desktop GUI
│   ├── src/
│   │   ├── components/           # BrandBrain, ResearchHub, ScriptGen, Teleprompter, SimpleStudio, etc.
│   │   └── app/                  # Studio Page & Layout
│   └── package.json
├── engine/                       # Local Python AI & Video Backend
│   ├── api/server.py             # FastAPI REST & WebSocket Daemon
│   ├── ai/                       # Whisper INT8, Silero-VAD, Gemini Research, Script Matcher
│   ├── audio/                    # yt-dlp Music Fetcher, Librosa Beat Detector, SFX Ducking
│   ├── video/                    # Kinetic Subtitles, Punch Zoom, Hook Banner, NVENC Renderer
│   └── requirements.txt
├── sfx_library/                  # Built-in sound effects (whoosh, pop, ding, riser, shutter)
├── start_studio.bat              # 1-Click Native Windows Launcher
└── README.md                     # Documentation
```

---

## 🚀 1-Click Quickstart on Windows

### Prerequisites
1. **Python 3.10+** (Ensure "Add Python to PATH" was checked during installation).
2. **Node.js v18+** (from [nodejs.org](https://nodejs.org)).
3. **NVIDIA GPU** with CUDA drivers (GTX 1660 / RTX 2060 or higher recommended).

### Launching the Studio
Simply double-click:
```bash
start_studio.bat
```
This will automatically:
1. Initialize the Python virtual environment and dependencies.
2. Start the local Python GPU AI Engine on `http://127.0.0.1:8000`.
3. Start the Next.js Desktop GUI on `http://localhost:3000`.
4. Open your browser to the Studio Dashboard!

---

## 📄 License
MIT License. Built for creators, founders, and video editors worldwide.
