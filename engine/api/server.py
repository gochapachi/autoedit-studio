import os
import sys
import uuid
import json
import logging
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from ai.gemini_research import GeminiResearchEngine
from ai.transcriber import FastTranscriber
from ai.vad_silence import SilenceTrimmer
from ai.script_aligner import ScriptAligner
from ai.take_selector import FillerAndTakeOptimizer
from ai.face_tracker import Smart916Reframe
from ai.voice_master import StudioVoiceMaster
from ai.eye_contact import EyeContactCorrector
from audio.ytdlp_fetcher import YTDLPFetcher
from audio.beat_detector import BeatDetector
from audio.sfx_ducking import SFXAndDuckingSuite
from video.subtitle_gen import SubtitleGenerator
from video.punch_zoom import RetentionPunchZoom
from video.hook_banner import TopHookBanner
from video.color_luts import ColorGradingSuite
from video.gpu_renderer import GPURenderEngine

# Configure Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("AutoEdit.Server")

app = FastAPI(title="AutoEdit Studio GPU AI Engine", version="2.0.0")

# Enable CORS for Next.js Desktop frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Workspace directories
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECTS_DIR = os.path.join(BASE_DIR, "projects")
EXPORTS_DIR = os.path.join(BASE_DIR, "exports")
DOWNLOADS_DIR = os.path.join(BASE_DIR, "downloads")
SFX_DIR = os.path.join(BASE_DIR, "sfx_library")

for d in [PROJECTS_DIR, EXPORTS_DIR, DOWNLOADS_DIR, SFX_DIR]:
    os.makedirs(d, exist_ok=True)

# Mount static files for local audio/video previews
app.mount("/projects", StaticFiles(directory=PROJECTS_DIR), name="projects")
app.mount("/exports", StaticFiles(directory=EXPORTS_DIR), name="exports")
app.mount("/sfx", StaticFiles(directory=SFX_DIR), name="sfx")

# Initialize AI & Media Engines
gemini_engine = GeminiResearchEngine()
transcriber = FastTranscriber(model_size="base")
vad_trimmer = SilenceTrimmer()
script_aligner = ScriptAligner()
take_optimizer = FillerAndTakeOptimizer()
face_reframe = Smart916Reframe()
voice_master = StudioVoiceMaster()
eye_corrector = EyeContactCorrector()
ytdlp_fetcher = YTDLPFetcher(download_dir=os.path.join(DOWNLOADS_DIR, "audio"))
beat_detector = BeatDetector()
sfx_suite = SFXAndDuckingSuite(sfx_dir=SFX_DIR)
subtitle_gen = SubtitleGenerator()
punch_zoom = RetentionPunchZoom()
hook_banner = TopHookBanner()
color_luts = ColorGradingSuite()
gpu_renderer = GPURenderEngine()

# Active WebSocket connections for live progress
active_connections: List[WebSocket] = []

async def broadcast_progress(step: str, percentage: int, message: str, project_id: str = ""):
    payload = {
        "step": step,
        "percentage": percentage,
        "message": message,
        "project_id": project_id
    }
    for connection in active_connections:
        try:
            await connection.send_json(payload)
        except Exception:
            pass

@app.websocket("/ws/progress")
async def websocket_progress_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections.remove(websocket)

# ----------------- REST Endpoints ----------------- #

@app.get("/api/health")
def get_system_health():
    gpu_available = False
    gpu_name = "CPU Only"
    try:
        import torch
        gpu_available = torch.cuda.is_available()
        if gpu_available:
            gpu_name = torch.cuda.get_device_name(0)
    except Exception:
        pass

    return {
        "status": "online",
        "gpu_available": gpu_available,
        "gpu_name": gpu_name,
        "encoder": gpu_renderer.encoder,
        "vram_cap_guarantee": "< 4.0 GB",
        "version": "2.0.0"
    }

class BrandBrainRequest(BaseModel):
    name: str
    niche: str
    audience: str
    voice: str
    cta_goal: str
    gemini_api_key: Optional[str] = None

@app.post("/api/brand-brain/save")
def save_brand_brain(req: BrandBrainRequest):
    if req.gemini_api_key:
        gemini_engine.set_api_key(req.gemini_api_key)
    
    config_path = os.path.join(BASE_DIR, "brand_profile.json")
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(req.dict(), f, indent=2)
    
    return {"status": "success", "profile": req.dict()}

@app.get("/api/brand-brain/get")
def get_brand_brain():
    config_path = os.path.join(BASE_DIR, "brand_profile.json")
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "name": "AutoEdit Agency",
        "niche": "AI Video Marketing",
        "audience": "Entrepreneurs & Creators",
        "voice": "High-Energy, Authoritative & Actionable",
        "cta_goal": "Comment 'GROWTH' for free template",
        "gemini_api_key": ""
    }

class ResearchRequest(BaseModel):
    niche: str
    topic: str
    gemini_api_key: Optional[str] = None

@app.post("/api/gemini/research")
def research_topic(req: ResearchRequest):
    if req.gemini_api_key:
        gemini_engine.set_api_key(req.gemini_api_key)
    return gemini_engine.research_keywords_and_trends(req.niche, req.topic)

class ScriptRequest(BaseModel):
    topic: str
    business_profile: Dict[str, Any]
    target_duration_sec: int = 45
    gemini_api_key: Optional[str] = None

@app.post("/api/gemini/generate-script")
def generate_script(req: ScriptRequest):
    if req.gemini_api_key:
        gemini_engine.set_api_key(req.gemini_api_key)
    return gemini_engine.generate_viral_script(req.topic, req.business_profile, req.target_duration_sec)

class SocialCopyRequest(BaseModel):
    script_text: str
    business_name: str = ""
    gemini_api_key: Optional[str] = None

@app.post("/api/gemini/social-copy")
def generate_social_copy(req: SocialCopyRequest):
    if req.gemini_api_key:
        gemini_engine.set_api_key(req.gemini_api_key)
    return gemini_engine.generate_social_package(req.script_text, req.business_name)

@app.post("/api/upload")
async def upload_raw_video(file: UploadFile = File(...)):
    project_id = str(uuid.uuid4())[:8]
    proj_path = os.path.join(PROJECTS_DIR, project_id)
    os.makedirs(proj_path, exist_ok=True)
    
    file_ext = os.path.splitext(file.filename)[1] or ".mp4"
    save_path = os.path.join(proj_path, f"raw_video{file_ext}")
    
    with open(save_path, "wb") as f:
        content = await file.read()
        f.write(content)

    return {
        "status": "success",
        "project_id": project_id,
        "filename": file.filename,
        "local_path": save_path,
        "url": f"/projects/{project_id}/raw_video{file_ext}"
    }

def _find_project_video(project_id: str, video_path: Optional[str] = None) -> str:
    if video_path and os.path.exists(video_path):
        return video_path
    proj_path = os.path.join(PROJECTS_DIR, project_id)
    for ext in [".webm", ".mp4", ".mov", ".mkv", ".avi", ".wav", ".mp3"]:
        p = os.path.join(proj_path, f"raw_video{ext}")
        if os.path.exists(p):
            return p
    if os.path.exists(proj_path):
        files = [os.path.join(proj_path, f) for f in os.listdir(proj_path) if not f.endswith(('.json', '.ass'))]
        if files:
            return files[0]
    return os.path.join(proj_path, "raw_video.mp4")

class TranscribeRequest(BaseModel):
    project_id: str
    video_path: Optional[str] = None
    language: Optional[str] = None

@app.post("/api/project/transcribe")
async def transcribe_video(req: TranscribeRequest):
    proj_path = os.path.join(PROJECTS_DIR, req.project_id)
    os.makedirs(proj_path, exist_ok=True)
    target_video = _find_project_video(req.project_id, req.video_path)
    
    logger.info(f"Starting Whisper transcription for project [{req.project_id}], target: {target_video}")
    await broadcast_progress("transcription", 25, "Running faster-whisper word-level transcription...", req.project_id)
    
    res = transcriber.transcribe(target_video, language=req.language)
    
    # Save transcript to project
    with open(os.path.join(proj_path, "transcript.json"), "w", encoding="utf-8") as f:
        json.dump(res, f, indent=2)

    await broadcast_progress("transcription", 100, "Transcription completed!", req.project_id)
    return res

class VADRequest(BaseModel):
    project_id: str
    min_silence_sec: float = 0.35

@app.post("/api/project/clean-vad")
def clean_silences(req: VADRequest):
    target_video = _find_project_video(req.project_id)
    return vad_trimmer.detect_speech_intervals(target_video, min_silence_sec=req.min_silence_sec)

class FillerCleanRequest(BaseModel):
    words: List[Dict[str, Any]]

@app.post("/api/project/clean-fillers")
def clean_fillers(req: FillerCleanRequest):
    return take_optimizer.detect_fillers(req.words)

class AlignScriptRequest(BaseModel):
    script: Dict[str, Any]
    transcription: Dict[str, Any]

@app.post("/api/project/align-script")
def align_script_and_takes(req: AlignScriptRequest):
    return script_aligner.align_script_to_transcription(req.script, req.transcription)

class BGMSearchRequest(BaseModel):
    query_or_url: str

@app.post("/api/bgm/search")
def search_or_fetch_bgm(req: BGMSearchRequest):
    res = ytdlp_fetcher.fetch_track(req.query_or_url)
    if res.get("file_path") and os.path.exists(res["file_path"]):
        beats = beat_detector.analyze_beats(res["file_path"])
        res["beats"] = beats
    return res

class EyeContactRequest(BaseModel):
    project_id: str
    intensity: float = 0.85

@app.post("/api/project/eye-contact")
def apply_eye_contact_correction(req: EyeContactRequest):
    proj_path = os.path.join(PROJECTS_DIR, req.project_id)
    target_video = os.path.join(proj_path, "raw_video.mp4")
    return eye_corrector.compute_gaze_correction_map(target_video, intensity=req.intensity)

class FullRenderRequest(BaseModel):
    project_id: str
    style_name: str = "hormozi"
    enable_hook_banner: bool = True
    hook_banner_text: str = ""
    enable_punch_zoom: bool = True
    color_lut_preset: str = "clean_studio"
    bgm_url_or_preset: Optional[str] = None
    target_width: int = 1080
    target_height: int = 1920

@app.post("/api/project/render-nvenc")
async def render_project_nvenc(req: FullRenderRequest, background_tasks: BackgroundTasks):
    proj_path = os.path.join(PROJECTS_DIR, req.project_id)
    input_video = _find_project_video(req.project_id)
    output_video = os.path.join(EXPORTS_DIR, f"{req.project_id}_viral_short.mp4")
    
    # Load transcript
    transcript_path = os.path.join(proj_path, "transcript.json")
    words = []
    if os.path.exists(transcript_path):
        with open(transcript_path, "r", encoding="utf-8") as f:
            t_data = json.load(f)
            words = t_data.get("words", [])

    # 1. Generate Subtitle ASS file
    ass_path = os.path.join(proj_path, "captions.ass")
    if words:
        subtitle_gen.generate_ass_subtitles(words, ass_path, style_name=req.style_name)

    # 2. Punch Zoom Filter
    zoom_filter = None
    if req.enable_punch_zoom:
        intervals = punch_zoom.generate_zoom_intervals(60.0)
        zoom_filter = punch_zoom.get_ffmpeg_zoom_filter(intervals)

    # 3. Color LUT
    lut_filter = color_luts.get_filter(req.color_lut_preset)

    # 4. Hook Banner
    banner_filter = None
    if req.enable_hook_banner and req.hook_banner_text:
        banner_filter = hook_banner.get_ffmpeg_drawtext_filter(req.hook_banner_text)

    # 5. Fetch BGM if specified
    bgm_file = None
    if req.bgm_url_or_preset:
        bgm_res = ytdlp_fetcher.fetch_track(req.bgm_url_or_preset)
        bgm_file = bgm_res.get("file_path")

    await broadcast_progress("render", 50, "Hardware NVENC Compositing started...", req.project_id)

    render_result = gpu_renderer.render_final_short(
        input_video=input_video,
        output_video=output_video,
        ass_subtitle_path=ass_path if os.path.exists(ass_path) else None,
        bgm_path=bgm_file,
        color_lut_filter=lut_filter,
        hook_banner_filter=banner_filter,
        zoom_filter=zoom_filter,
        target_width=req.target_width,
        target_height=req.target_height
    )

    await broadcast_progress("render", 100, "Render completed!", req.project_id)

    return {
        "status": "success",
        "output_url": f"/exports/{req.project_id}_viral_short.mp4",
        "local_path": output_video,
        "render_details": render_result
    }
