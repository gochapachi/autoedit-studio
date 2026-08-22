# 📐 AutoEdit Studio — System Architecture & Technical Specifications

This document details the internal design, memory guarantees, hardware pipelines, and lifecycle models of the AutoEdit Studio platform.

---

## 🌟 The 4-Stage Full-Funnel Content Pipeline

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: BRAND STRATEGY & SCRIPTING                                                                      │
│ • Local Ollama LLM / Offline Heuristic Engine                                                            │
│ • YouTube Channel Deep Audit via yt-dlp metadata extraction                                              │
│ • Custom Script Doctor Refiner (Raw founder notes -> 30-60s retention scripts)                            │
│ • Persistent History Store (engine/storage/history.json)                                                 │
└──────────────────────────────────────────────────┬───────────────────────────────────────────────────────┘
                                                   │ Structured Script JSON
┌──────────────────────────────────────────────────▼───────────────────────────────────────────────────────┐
│ STAGE 2: FLOATING TELEPROMPTER & RECORDING                                                               │
│ • Clean Translucent Desktop Prompter Overlay                                                             │
│ • Auto-scroll synchronized with target WPM (Words Per Minute)                                            │
│ • Visual Action Cues ([Point to camera]) and SFX badges ([pop], [riser])                                  │
│ • Multi-Take Recording Buffer                                                                            │
└──────────────────────────────────────────────────┬───────────────────────────────────────────────────────┘
                                                   │ Raw Video Takes (.mp4 / .webm)
┌──────────────────────────────────────────────────▼───────────────────────────────────────────────────────┐
│ STAGE 3: DROP & AUTO-EDIT STUDIO                                                                         │
│ • faster-whisper (INT8 quantized) -> Word-Level Timestamps                                              │
│ • Silero-VAD -> Detects & trims awkward pauses (>0.35s gaps)                                             │
│ • Take Optimizer -> Purges filler words ("um", "uh", "like") & aligns best delivery                      │
│ • Kinetic ASS Subtitles -> Word-by-word active glow, bounce & color shift (Hormozi, MrBeast, Cyberpunk) │
│ • Audio Ducking Suite -> Librosa beat alignment & vocal sidechain auto-ducking to -18dB                  │
│ • Retention Punch-Zoom -> 1.15x rhythmic zoom cuts every 3-4s                                            │
└──────────────────────────────────────────────────┬───────────────────────────────────────────────────────┘
                                                   │ Composite Graph
┌──────────────────────────────────────────────────▼───────────────────────────────────────────────────────┐
│ STAGE 4: GPU NVENC EXPORT & PUBLISH                                                                      │
│ • Hardware-accelerated NVIDIA NVENC (h264_nvenc) @ 1080x1920 60fps                                       │
│ • ~6 to 8 seconds total render time                                                                      │
│ • 1-Click Social Packaging (3 high-CTR titles, SEO description with chapters, 15 hashtags)               │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ 8GB VRAM Safeguard Architecture

To ensure crash-free execution on consumer NVIDIA GPUs (e.g. GTX 1660 / RTX 2060 / RTX 3060 / RTX 4060):

| Subsystem | Model / Technology | VRAM Footprint | Execution Phase |
| :--- | :--- | :--- | :--- |
| **Local LLM** | Ollama (`llama3.2:3b` / `qwen2.5:3b`) | **~2.2 GB VRAM** | Stage 1 (Unloaded after generation) |
| **Speech-to-Text** | `faster-whisper` (INT8 quantized) | **~1.8 GB VRAM** | Stage 3 (Sequential) |
| **Voice Activity** | `Silero-VAD` (TorchScript) | **~80 MB VRAM** | Stage 3 (Sequential) |
| **Face Reframe** | OpenCV + MediaPipe | **~200 MB VRAM** | Stage 3 (CPU/DirectML) |
| **Video Encoding** | NVIDIA NVENC Hardware ASIC | **0 MB CUDA Memory** | Stage 4 (Dedicated NVENC Silicon) |
| **Peak VRAM Cap** | **Sequential Lifecycle** | **< 3.5 GB VRAM** | Safe on 4GB/6GB/8GB GPUs |

---

## 🔄 Stateful Persistence & History Model

All creator data persists on-device in `engine/storage/history.json`:

```json
{
  "topics": [
    {
      "id": "t1",
      "topic": "3 AI Tools That Automate Video Editing",
      "niche": "AI Video Marketing",
      "created_at": 1786771170.5,
      "favorite": true
    }
  ],
  "scripts": [
    {
      "id": "s1",
      "title": "Automate Video Editing in 30 Seconds",
      "topic": "3 AI Tools That Automate Video Editing",
      "script_type": "custom_refined",
      "duration": 45,
      "script": { ... },
      "created_at": 1786771170.5,
      "favorite": false
    }
  ],
  "youtube_audits": [
    {
      "id": "ya1",
      "channel_title": "thealexhormozi",
      "channel_url": "https://www.youtube.com/@thealexhormozi/videos",
      "subscriber_count": "Verified",
      "video_count": 12,
      "data": { ... },
      "created_at": 1786771170.5,
      "favorite": false
    }
  ],
  "brand_profiles": []
}
```

---

## 🎬 Subtitle Generation (.ASS Format)

Subtitles use Advanced SubStation Alpha (`.ass`) with karaoke timing (`\k<duration_cs>`):
```
[Script Info]
Title: AutoEdit Studio Kinetic Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Montserrat,72,&H00FFFFFF,&H0000E5FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,12,6,5,40,40,960,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:01.20,Default,,0,0,0,,{\k30}STOP {\k45\c&H0000E5FF}SCROLLING {\k45}NOW!
```

---

## 🔌 API Endpoint Reference

| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | System health, GPU availability, active local model, and encoder |
| `GET` | `/api/brand-brain/get` | Get active brand profile from disk |
| `POST` | `/api/brand-brain/save` | Save active brand profile to disk |
| `POST` | `/api/local-ai/research` | Run local SEO trend & competitor hook research |
| `POST` | `/api/local-ai/generate-script` | Generate 30-60s retention script from custom topic |
| `POST` | `/api/local-ai/refine-script` | Transform raw founder notes into structured script with cues |
| `POST` | `/api/local-ai/social-copy` | Generate 3 viral titles, description, timestamps, and hashtags |
| `GET` | `/api/local-ai/models` | List installed Ollama local models |
| `POST` | `/api/local-ai/pull-model` | Pull an Ollama model locally |
| `POST` | `/api/research/youtube-channel`| Perform real YouTube channel business audit via `yt-dlp` |
| `GET` | `/api/history` | Retrieve full persistent history (topics, scripts, audits) |
| `POST` | `/api/history/save-topic` | Save or deduplicate topic in history |
| `POST` | `/api/history/save-script` | Save or update script in history |
| `POST` | `/api/history/toggle-favorite`| Toggle star/favorite on any item |
| `POST` | `/api/history/delete-item` | Delete an item from history |
| `POST` | `/api/upload` | Upload raw multi-take video files |
| `POST` | `/api/project/transcribe` | Run `faster-whisper` word-level transcription |
| `POST` | `/api/project/clean-vad` | Detect speech intervals and trim silences with `Silero-VAD` |
| `POST` | `/api/bgm/search` | Search / fetch background music via `yt-dlp` with beat detection |
| `POST` | `/api/project/render-nvenc` | Composite & render final 1080x1920 short via NVIDIA NVENC |
| `WS` | `/ws/progress` | Live WebSocket progress stream (transcription, rendering) |
