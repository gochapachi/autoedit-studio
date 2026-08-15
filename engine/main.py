import os
import sys
import uvicorn

# Ensure engine modules are in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("=================================================================")
    print("   AUTOEDIT STUDIO - LOCAL GPU AI VIDEO ENGINE (WINDOWS NATIVE)  ")
    print("=================================================================")
    print(" • Speech AI: faster-whisper (INT8 quantized, <4GB VRAM Cap)")
    print(" • Silence & VAD: Silero-VAD Millisecond Trimmer")
    print(" • Visuals: 9:16 Face-Tracking Reframe & Kinetic Subtitles")
    print(" • Audio Suite: yt-dlp BGM Beat Detector & Sidechain Ducking")
    print(" • Engine: FFmpeg NVENC Hardware Accelerated Compositor")
    print(" • Strategy & Scripts: Gemini AI Integration")
    print("=================================================================")
    uvicorn.run("api.server:app", host="127.0.0.1", port=8000, reload=False)
