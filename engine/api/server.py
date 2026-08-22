import os
import sys
import uuid
import json
import asyncio
import logging
import subprocess
from typing import Dict, Any, List, Optional, Callable
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ai.local_ai import LocalAIEngine, DEFAULT_MODEL
from ai.ollama_manager import OllamaManager
from ai.research_agent import BusinessResearchAgent
from ai.youtube_research import YouTubeChannelAuditor
from ai.seo_radar import RealtimeSEORadar
from storage.history_store import LocalHistoryStore
from ai.transcriber import FastTranscriber
from ai.vad_silence import SilenceTrimmer
from ai.script_aligner import ScriptAligner
from ai.take_selector import FillerAndTakeOptimizer
from ai.eye_contact import EyeContactCorrector
from audio.ytdlp_fetcher import YTDLPFetcher
from audio.beat_detector import BeatDetector
from video.subtitle_gen import SubtitleGenerator
from video.punch_zoom import RetentionPunchZoom
from video.hook_banner import TopHookBanner
from video.color_luts import ColorGradingSuite
from video.gpu_renderer import GPURenderEngine
from video.broll import BRollGenerator
from video.wgp_provider import WanGPProvider, VIDEO_DEFAULT, IMAGE_PROVIDERS
from ai.auto_editor import AutoEditAgent

# Configure Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("AutoEdit.Server")

app = FastAPI(title="AutoEdit Studio 100% Local AI Engine", version="2.5.0")

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
STORAGE_DIR = os.path.join(BASE_DIR, "storage")

for d in [PROJECTS_DIR, EXPORTS_DIR, DOWNLOADS_DIR, SFX_DIR, STORAGE_DIR]:
    os.makedirs(d, exist_ok=True)

# Mount static files for local audio/video previews
app.mount("/projects", StaticFiles(directory=PROJECTS_DIR), name="projects")
app.mount("/exports", StaticFiles(directory=EXPORTS_DIR), name="exports")
app.mount("/sfx", StaticFiles(directory=SFX_DIR), name="sfx")

# Initialize 100% Local AI & Media Engines
local_ai = LocalAIEngine()
ollama_manager = OllamaManager()
research_agent = BusinessResearchAgent()
youtube_auditor = YouTubeChannelAuditor(local_ai=local_ai)
seo_radar = RealtimeSEORadar()
history_store = LocalHistoryStore(storage_dir=STORAGE_DIR)

transcriber = FastTranscriber(model_size="base")
vad_trimmer = SilenceTrimmer()
script_aligner = ScriptAligner()
take_optimizer = FillerAndTakeOptimizer()
eye_corrector = EyeContactCorrector()
ytdlp_fetcher = YTDLPFetcher(download_dir=os.path.join(DOWNLOADS_DIR, "audio"))
beat_detector = BeatDetector()
subtitle_gen = SubtitleGenerator()
punch_zoom = RetentionPunchZoom()
hook_banner = TopHookBanner()
color_luts = ColorGradingSuite()
gpu_renderer = GPURenderEngine()
broll_generator = BRollGenerator(ffmpeg_exe=gpu_renderer.ffmpeg_exe)
wgp_provider = WanGPProvider(ffmpeg_exe=gpu_renderer.ffmpeg_exe)
auto_editor = AutoEditAgent(local_ai=local_ai)


def _require_nonempty(value: Optional[str], field: str) -> str:
    """Validate a required string field and raise a clean 422 otherwise."""
    cleaned = (value or "").strip()
    if not cleaned:
        raise HTTPException(status_code=422, detail=f"Field '{field}' must not be empty.")
    return cleaned


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc: Exception):
    logger.exception(f"Unhandled error on {request.url.path}: {exc}")
    return JSONResponse(status_code=500, content={"status": "error", "message": str(exc)})

# Active WebSocket connections for live progress
active_connections: List[WebSocket] = []

# Use the model the user chose last time (falls back to any installed model)
try:
    with open(os.path.join(BASE_DIR, "brand_profile.json"), "r", encoding="utf-8") as _f:
        _preferred_model = json.load(_f).get("model_name")
    if _preferred_model and local_ai._is_model_installed(_preferred_model):
        local_ai.set_model(_preferred_model)
        logger.info(f"Active AI model: {_preferred_model}")
except Exception:
    pass

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

    local_models = local_ai.list_models()
    return {
        "status": "online",
        "gpu_available": gpu_available,
        "gpu_name": gpu_name,
        "encoder": gpu_renderer.encoder,
        "gpu_rendering": gpu_renderer.encoder != "libx264",
        "vram_cap_guarantee": "< 4.0 GB",
        "local_ai_mode": "100% On-Device Local",
        "ollama_available": len(local_models) > 0,
        "active_model": local_ai.active_model,
        "version": "2.5.0"
    }

class BrandBrainRequest(BaseModel):
    name: str
    niche: str
    audience: str
    voice: str
    cta_goal: str
    model_name: Optional[str] = DEFAULT_MODEL

@app.post("/api/brand-brain/save")
def save_brand_brain(req: BrandBrainRequest):
    _require_nonempty(req.name, "name")
    _require_nonempty(req.niche, "niche")
    if req.model_name:
        local_ai.set_model(req.model_name)

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
        "name": "",
        "niche": "",
        "audience": "",
        "voice": "",
        "cta_goal": "",
        "model_name": DEFAULT_MODEL
    }

# ----------------- AGENTIC BUSINESS RESEARCH & CHAT IDEATION ----------------- #

class AgentBusinessResearchRequest(BaseModel):
    business_name: str
    niche: str
    target_audience: str = ""
    youtube_url: Optional[str] = ""
    goal: Optional[str] = ""
    model_name: Optional[str] = DEFAULT_MODEL

@app.post("/api/agent/research-business")
def agent_research_business(req: AgentBusinessResearchRequest):
    """
    Autonomous multi-step research on business, niche, web competitors, and YouTube channel.
    Synthesizes and saves to persistent Brand Brain memory.
    """
    _require_nonempty(req.business_name, "business_name")
    _require_nonempty(req.niche, "niche")
    if req.model_name:
        research_agent.active_model = req.model_name
        local_ai.set_model(req.model_name)

    result = research_agent.execute_agentic_research(
        business_name=req.business_name,
        niche=req.niche,
        target_audience=req.target_audience,
        youtube_url=req.youtube_url or "",
        goal=req.goal or ""
    )

    is_fallback = result.get("is_fallback", False)

    # Save to persistent brand profile. Research-derived fields are only persisted
    # when they came from the real model, so an Ollama outage can't pollute brand memory.
    profile_data = {
        "name": req.business_name,
        "niche": req.niche,
        "audience": req.target_audience,
        "youtube_url": req.youtube_url or "",
        "model_name": req.model_name or DEFAULT_MODEL,
        "research_source": result.get("source", "unknown")
    }
    if not is_fallback:
        profile_data.update({
            "audience": req.target_audience or result.get("target_persona", {}).get("title", ""),
            "voice": result.get("recommended_voice", "Energetic, Direct & Actionable"),
            "cta_goal": result.get("cta_strategy", "Comment 'GROWTH' / Link in bio"),
            "brand_summary": result.get("brand_summary", ""),
            "content_pillars": result.get("content_pillars", []),
            "viral_ideas": result.get("viral_ideas", []),
        })

    config_path = os.path.join(BASE_DIR, "brand_profile.json")
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(profile_data, f, indent=2)

    # Save top topics to history
    for idea in result.get("viral_ideas", [])[:3]:
        history_store.save_topic(idea.get("topic", ""), req.niche)

    return {
        "status": "success",
        "research": result,
        "saved_profile": profile_data
    }

class AgentChatIdeateRequest(BaseModel):
    message: str
    business_profile: Optional[Dict[str, Any]] = None
    current_script: Optional[Dict[str, Any]] = None
    target_format: Optional[str] = None
    model_name: Optional[str] = DEFAULT_MODEL

@app.post("/api/agent/chat-ideate")
def agent_chat_ideate(req: AgentChatIdeateRequest):
    """
    Conversational brainstorming with the founder: proposes viral angles & formats and generates / modifies scripts.
    """
    _require_nonempty(req.message, "message")
    ollama_manager.ensure_running(wait_seconds=20)
    if req.model_name:
        local_ai.set_model(req.model_name)

    return local_ai.chat_ideate_topics(
        user_message=req.message,
        business_profile=req.business_profile,
        current_script=req.current_script,
        target_format=req.target_format
    )

# ----------------- 100% LOCAL AI ENDPOINTS ----------------- #

class LocalResearchRequest(BaseModel):
    niche: str
    topic: str
    model_name: Optional[str] = None

@app.post("/api/local-ai/research")
@app.post("/api/gemini/research")
def local_research_topic(req: LocalResearchRequest):
    _require_nonempty(req.topic, "topic")
    if req.model_name:
        local_ai.set_model(req.model_name)
    
    # Fetch 100% Real-Time Factual Data via Live YouTube Autocomplete & Ranking Video Search
    result = seo_radar.fetch_live_seo_radar(req.niche, req.topic)
    # Save to history automatically
    history_store.save_topic(req.topic, req.niche)
    return result

class LocalScriptRequest(BaseModel):
    topic: str
    business_profile: Dict[str, Any]
    target_duration_sec: int = 45
    model_name: Optional[str] = None

@app.post("/api/local-ai/generate-script")
@app.post("/api/gemini/generate-script")
def local_generate_script(req: LocalScriptRequest):
    _require_nonempty(req.topic, "topic")
    if not (15 <= req.target_duration_sec <= 180):
        raise HTTPException(status_code=422, detail="target_duration_sec must be between 15 and 180.")
    # Boot the local Ollama daemon on demand so one click just works
    ollama_manager.ensure_running(wait_seconds=20)
    if req.model_name:
        local_ai.set_model(req.model_name)
    
    script = local_ai.generate_viral_script(req.topic, req.business_profile, req.target_duration_sec)
    # Save generated script to history
    history_store.save_script(script, topic=req.topic, script_type="generated")
    history_store.save_topic(req.topic, req.business_profile.get("niche", ""))
    return script

class RefineScriptRequest(BaseModel):
    raw_text: str
    business_profile: Dict[str, Any]
    target_duration_sec: int = 45
    model_name: Optional[str] = None

@app.post("/api/local-ai/refine-script")
def local_refine_script(req: RefineScriptRequest):
    _require_nonempty(req.raw_text, "raw_text")
    if not (15 <= req.target_duration_sec <= 180):
        raise HTTPException(status_code=422, detail="target_duration_sec must be between 15 and 180.")
    ollama_manager.ensure_running(wait_seconds=20)
    if req.model_name:
        local_ai.set_model(req.model_name)

    script = local_ai.refine_custom_script(req.raw_text, req.business_profile, req.target_duration_sec)
    # Save custom refined script to history
    history_store.save_script(script, topic=script.get("title", "Custom Script"), script_type="custom_refined")
    return script

class LocalSocialCopyRequest(BaseModel):
    script_text: str
    business_name: str = ""
    model_name: Optional[str] = None

@app.post("/api/local-ai/social-copy")
@app.post("/api/gemini/social-copy")
def local_generate_social_copy(req: LocalSocialCopyRequest):
    if req.model_name:
        local_ai.set_model(req.model_name)
    return local_ai.generate_social_package(req.script_text, req.business_name)

@app.get("/api/local-ai/models")
def get_local_models():
    running = ollama_manager.is_running()
    models = local_ai.list_models() if running else []
    return {
        "status": "success",
        "ollama_running": running,
        "active_model": local_ai.active_model,
        "models": models
    }


class EnsureOllamaRequest(BaseModel):
    wait_seconds: float = 20.0


@app.post("/api/local-ai/ensure-ollama")
def ensure_ollama_endpoint(req: EnsureOllamaRequest):
    """Starts the local Ollama daemon if needed and waits until it responds."""
    return ollama_manager.ensure_running(wait_seconds=min(req.wait_seconds, 60.0))


@app.get("/api/local-ai/unsloth-models")
def list_unsloth_models(q: str = ""):
    """Searchable Unsloth GGUF library (live from Hugging Face) with install sizes."""
    return ollama_manager.search_unsloth_models(query=q)


# In-flight model pulls keyed by model name (prevents duplicate downloads)
active_pulls: Dict[str, bool] = {}


class PullModelRequest(BaseModel):
    model_name: str


@app.post("/api/local-ai/pull-model")
async def pull_local_model(req: PullModelRequest):
    """Downloads a model in the background with live WebSocket progress."""
    model_name = _require_nonempty(req.model_name, "model_name")
    running = ollama_manager.ensure_running(wait_seconds=15)
    if not running.get("running"):
        raise HTTPException(status_code=503, detail=running.get("error") or "Could not start Ollama.")

    if model_name in active_pulls:
        return {"status": "already_downloading", "model": model_name}
    if model_name.lower() in [m.lower() for m in ollama_manager.list_installed_models()]:
        local_ai.set_model(model_name)
        return {"status": "already_installed", "model": model_name}

    loop = asyncio.get_event_loop()

    def _pull_progress(pct: int, message: str):
        asyncio.run_coroutine_threadsafe(
            broadcast_progress("pull", pct, message, model_name),
            loop
        )

    def _run_pull():
        active_pulls[model_name] = True
        try:
            result = ollama_manager.pull_model_stream(model_name, progress_cb=_pull_progress)
            if result.get("status") == "success":
                local_ai.set_model(model_name)
        finally:
            active_pulls.pop(model_name, None)

    import threading
    threading.Thread(target=_run_pull, daemon=True).start()
    return {"status": "started", "model": model_name}

# ----------------- YOUTUBE CHANNEL RESEARCH ----------------- #

class YouTubeAuditRequest(BaseModel):
    channel_input: str

@app.post("/api/research/youtube-channel")
def audit_youtube_channel(req: YouTubeAuditRequest):
    _require_nonempty(req.channel_input, "channel_input")
    result = youtube_auditor.audit_channel(req.channel_input)
    # Save audit to history
    history_store.save_youtube_audit(result)
    return result

# ----------------- STATEFUL HISTORY STORE ----------------- #

@app.get("/api/history")
def get_creator_history():
    return history_store.get_all()

class SaveTopicRequest(BaseModel):
    topic: str
    niche: str = ""

@app.post("/api/history/save-topic")
def save_history_topic(req: SaveTopicRequest):
    return history_store.save_topic(req.topic, req.niche)

class SaveScriptHistoryRequest(BaseModel):
    script_data: Dict[str, Any]
    topic: str = ""
    script_type: str = "generated"

@app.post("/api/history/save-script")
def save_history_script(req: SaveScriptHistoryRequest):
    return history_store.save_script(req.script_data, topic=req.topic, script_type=req.script_type)

class ToggleFavoriteRequest(BaseModel):
    category: str  # 'topics', 'scripts', 'youtube_audits'
    item_id: str

@app.post("/api/history/toggle-favorite")
def toggle_history_favorite(req: ToggleFavoriteRequest):
    fav_state = history_store.toggle_favorite(req.category, req.item_id)
    return {"status": "success", "is_favorite": fav_state}

class DeleteHistoryItemRequest(BaseModel):
    category: str
    item_id: str

@app.post("/api/history/delete-item")
def delete_history_item(req: DeleteHistoryItemRequest):
    deleted = history_store.delete_item(req.category, req.item_id)
    return {"status": "success", "deleted": deleted}

@app.post("/api/upload")
async def upload_raw_video(file: UploadFile = File(...), project_id: Optional[str] = Form(None)):
    """
    Uploads one video file. Pass the same `project_id` on repeated calls to add
    multiple takes to one project (they get merged for the Quick Edit flow).
    """
    if project_id and os.path.isdir(os.path.join(PROJECTS_DIR, project_id)):
        proj_path = os.path.join(PROJECTS_DIR, project_id)
    else:
        project_id = str(uuid.uuid4())[:8]
        proj_path = os.path.join(PROJECTS_DIR, project_id)
        os.makedirs(proj_path, exist_ok=True)

    file_ext = os.path.splitext(file.filename)[1] or ".mp4"
    existing = [f for f in os.listdir(proj_path) if f.startswith("raw_video")]
    stem = "raw_video" if not existing else f"raw_video_{len(existing) + 1}"
    save_path = os.path.join(proj_path, f"{stem}{file_ext}")

    with open(save_path, "wb") as content_file:
        content = await file.read()
        content_file.write(content)

    return {
        "status": "success",
        "project_id": project_id,
        "filename": file.filename,
        "local_path": save_path,
        "url": f"/projects/{project_id}/{stem}{file_ext}",
        "file_count": len([f for f in os.listdir(proj_path) if f.startswith("raw_video")]),
    }


def _merge_project_videos(proj_path: str) -> Optional[str]:
    """Concatenates all raw_video* files into merged.mp4 (re-encoded, GPU-accelerated)."""
    files = sorted(
        f for f in os.listdir(proj_path)
        if f.startswith("raw_video") and not f.startswith("merged")
    )
    if not files:
        return None
    if len(files) == 1:
        return os.path.join(proj_path, files[0])

    merged = os.path.join(proj_path, "merged.mp4")
    list_file = os.path.join(proj_path, "concat_list.txt")
    with open(list_file, "w", encoding="utf-8") as f:
        for name in files:
            full = os.path.join(proj_path, name).replace("\\", "/")
            f.write(f"file '{full}'\n")

    vcodec = ["h264_nvenc", "-preset", "p5"] if gpu_renderer.encoder == "h264_nvenc" else ["libx264", "-preset", "fast"]
    cmd = [
        gpu_renderer.ffmpeg_exe, "-y", "-f", "concat", "-safe", "0",
        "-i", list_file, "-c:v", *vcodec, "-c:a", "aac", "-b:a", "192k",
        "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2",
        merged,
    ]
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res.returncode == 0 and os.path.exists(merged):
            return merged
        logger.warning(f"Merge failed: {res.stderr[-400:]}")
    except Exception as e:
        logger.warning(f"Merge error: {e}")
    return os.path.join(proj_path, files[0])


def _timestamped_transcript(words: List[Dict[str, Any]], chunk_sec: float = 8.0) -> str:
    """Groups word timestamps into readable lines for the LLM: [12.0-19.5] text..."""
    if not words:
        return ""
    lines, cur, t0 = [], [], None
    for w in words:
        s = float(w.get("start", 0))
        if t0 is None:
            t0 = s
        cur.append(str(w.get("word", "")))
        if float(w.get("end", 0)) - t0 >= chunk_sec:
            lines.append(f"[{t0:.1f}-{float(w['end']):.1f}] {' '.join(cur)}")
            cur, t0 = [], None
    if cur:
        end = float(words[-1].get("end", 0))
        lines.append(f"[{t0:.1f}-{end:.1f}] {' '.join(cur)}")
    return "\n".join(lines)


class QuickEditAnalyzeRequest(BaseModel):
    project_id: str
    model_name: Optional[str] = None


@app.post("/api/quickedit/analyze")
async def quickedit_analyze(req: QuickEditAnalyzeRequest):
    """
    Agentic auto-edit analysis: merges multi-file uploads, transcribes, finds
    silences/fillers, and produces an editable edit plan (B-roll moments, music,
    transitions, grade) — Remotion-style composition JSON.
    """
    _require_nonempty(req.project_id, "project_id")
    proj_path = os.path.join(PROJECTS_DIR, req.project_id)
    if not os.path.isdir(proj_path):
        raise HTTPException(status_code=404, detail=f"Project '{req.project_id}' not found.")
    ollama_manager.ensure_running(wait_seconds=20)
    if req.model_name:
        local_ai.set_model(req.model_name)

    await broadcast_progress("analyze", 5, "Merging your videos…", req.project_id)
    merged = await asyncio.to_thread(_merge_project_videos, proj_path)
    if not merged or not os.path.exists(merged):
        raise HTTPException(status_code=404, detail="No uploaded videos found in this project.")

    await broadcast_progress("analyze", 25, "Transcribing with local AI…", req.project_id)
    transcript = await asyncio.to_thread(transcriber.transcribe, merged)
    with open(os.path.join(proj_path, "transcript.json"), "w", encoding="utf-8") as f:
        json.dump(transcript, f, indent=2)
    words = transcript.get("words", [])

    await broadcast_progress("analyze", 55, "Detecting silences…", req.project_id)
    wav_path = os.path.join(proj_path, "vad_audio.wav")
    analyzed = gpu_renderer.extract_audio_wav(merged, wav_path) or merged
    vad = vad_trimmer.detect_speech_intervals(analyzed, min_silence_sec=0.35)
    filler_res = take_optimizer.detect_fillers(words)
    filler_spans = [[f["start"], f["end"]] for f in filler_res.get("fillers", [])]

    duration = float(gpu_renderer._probe_duration_sec(merged) or (words[-1]["end"] if words else 0) or 30)
    keep_segments = auto_editor.keep_segments_from(vad.get("speech_intervals", []), filler_spans, duration)

    await broadcast_progress("analyze", 75, "The AI editor is planning B-rolls & music…", req.project_id)
    ts_text = _timestamped_transcript(words)
    plan = await asyncio.to_thread(
        auto_editor.build_plan, words, ts_text, keep_segments, duration
    )
    plan["timeline"]["edited_duration"] = round(sum(s["end"] - s["start"] for s in keep_segments), 2)
    plan["timeline"]["silence_cut_sec"] = round(vad.get("total_silence_cut_sec", 0), 2)
    plan["timeline"]["fillers_removed"] = filler_res.get("fillers_count", 0)
    with open(os.path.join(proj_path, "quickedit_plan.json"), "w", encoding="utf-8") as f:
        json.dump(plan, f, indent=2)

    await broadcast_progress("analyze", 100, "Edit plan ready!", req.project_id)
    return {"status": "success", "plan": plan, "transcript": transcript, "merged": bool(len([f for f in os.listdir(proj_path) if f.startswith('raw_video')]) > 1)}


class QuickEditPlan(BaseModel):
    keep_segments: Optional[List[Dict[str, Any]]] = None
    brolls: Optional[List[Dict[str, Any]]] = None
    caption_style: str = "hormozi"
    captions_enabled: bool = True
    music_enabled: bool = True
    music_mood: str = "upbeat"
    look: str = "clean_studio"
    transition_style: str = "dip"
    # B-roll visual source: "cards" (always works) or WanGP local AI generation
    visual_provider: str = "cards"
    # User-corrected transcript words (used for captions instead of transcript.json)
    transcript_words: Optional[List[Dict[str, Any]]] = None


@app.get("/api/quickedit/providers")
def quickedit_providers():
    """Availability of B-roll visual providers (all local, via Wan2GP)."""
    status = wgp_provider.available()
    templates_ok = {}
    if status.get("available"):
        root = wgp_provider.find_root()
        templates_ok["ltx2_video"] = (root / "defaults" / f"{VIDEO_DEFAULT}.json").exists()
        for pid, name in IMAGE_PROVIDERS.items():
            templates_ok[pid] = (root / "defaults" / f"{name}.json").exists()
    return {
        "status": "success",
        "wanGP": status,
        "templates": templates_ok,
        "providers": [
            {"id": "cards", "name": "Animated cards", "available": True,
             "note": "Always works — no GPU generation needed"},
            {"id": "wgp_video", "name": "LTX-2 video (AI)", "available": bool(status.get("available") and templates_ok.get("ltx2_video")),
             "note": "Local AI video clips via Wan2GP — needs a powerful GPU, takes minutes per clip"},
            {"id": "wgp_ideogram", "name": "Ideogram v4 images (AI)", "available": bool(status.get("available") and templates_ok.get("wgp_ideogram")),
             "note": "Local AI images animated into cutaways via Wan2GP"},
            {"id": "wgp_krea", "name": "Krea 2 images (AI)", "available": bool(status.get("available") and templates_ok.get("wgp_krea")),
             "note": "Local AI images animated into cutaways via Wan2GP"},
        ],
    }


class QuickEditRenderRequest(BaseModel):
    project_id: str
    plan: QuickEditPlan


@app.post("/api/quickedit/render")
async def quickedit_render(req: QuickEditRenderRequest):
    """Renders the final video from the (user-editable) Quick Edit plan."""
    _require_nonempty(req.project_id, "project_id")
    proj_path = os.path.join(PROJECTS_DIR, req.project_id)
    if not os.path.isdir(proj_path):
        raise HTTPException(status_code=404, detail=f"Project '{req.project_id}' not found.")

    input_video = _merge_project_videos(proj_path)
    if not input_video or not os.path.exists(input_video):
        raise HTTPException(status_code=404, detail="No uploaded videos found in this project.")

    keep_segments = _merge_segments(req.plan.keep_segments or [], min_gap=0.0)
    applying_cuts = len(keep_segments) > 0
    remap = _make_time_remapper(keep_segments) if applying_cuts else (lambda t: t)

    # Captions from the (possibly user-corrected) transcript, remapped to the cut timeline
    words = list(req.plan.transcript_words or [])
    if not words:
        transcript_path = os.path.join(proj_path, "transcript.json")
        if os.path.exists(transcript_path):
            with open(transcript_path, "r", encoding="utf-8") as f:
                words = json.load(f).get("words", [])
    ass_path = os.path.join(proj_path, "captions.ass")
    if req.plan.captions_enabled and words:
        remapped = [
            {**w, "start": remap(float(w.get("start", 0))), "end": remap(float(w.get("end", 0)))}
            for w in words
        ]
        subtitle_gen.generate_ass_subtitles(remapped, ass_path, style_name=req.plan.caption_style)

    # B-roll: user files win → chosen AI provider (local Wan2GP) → animated cards
    await broadcast_progress("render", 15, "Preparing B-roll cutaways…", req.project_id)
    provider = req.plan.visual_provider
    wgp_ready = provider in ("wgp_video", "wgp_ideogram", "wgp_krea") and wgp_provider.available().get("available")
    broll_notes: List[str] = []
    overlays = []
    total_brolls = len([b for b in (req.plan.brolls or []) if float(b.get("end", 0)) - float(b.get("start", 0)) >= 1.0])

    for i, b in enumerate(req.plan.brolls or []):
        s, e = float(b.get("start", 0)), float(b.get("end", 0))
        if e - s < 1.0:
            continue
        slot = i + 1
        keyword = str(b.get("keyword", "key idea"))
        user_file = b.get("user_file")
        clip_path = None

        if user_file and os.path.exists(user_file):
            clip_path = user_file
        elif wgp_ready:
            await broadcast_progress("render", 15 + int(20 * slot / max(total_brolls, 1)), f"AI-generating B-roll {slot}/{total_brolls} ({provider})…", req.project_id)
            try:
                if provider == "wgp_video":
                    clip_path = await asyncio.to_thread(
                        wgp_provider.generate_video_clip, keyword, e - s, proj_path
                    )
                else:
                    clip_path = await asyncio.to_thread(
                        wgp_provider.generate_image_clip, provider, keyword, e - s, proj_path
                    )
            except Exception as ex:
                logger.warning(f"WanGP B-roll generation failed: {ex}")
                broll_notes.append(f"B-roll {slot}: AI generation failed, used an animated card instead.")

        if not clip_path or not os.path.exists(clip_path):
            clip_path = broll_generator.generate_card(
                keyword, os.path.join(proj_path, f"broll_{i}.mp4"), duration=e - s, palette_index=i
            )
        if clip_path and os.path.exists(clip_path):
            overlays.append({"path": clip_path, "start": remap(s), "end": remap(e)})

    # Transitions at every cut joint (post-cut timeline)
    boundaries = [remap(float(seg["start"])) for seg in keep_segments[1:]] if applying_cuts else []

    # Music by mood
    bgm_file = None
    if req.plan.music_enabled and req.plan.music_mood:
        await broadcast_progress("render", 25, f"Finding {req.plan.music_mood} music…", req.project_id)
        bgm_res = await asyncio.to_thread(
            ytdlp_fetcher.fetch_track, f"{req.plan.music_mood} no copyright background music"
        )
        bgm_file = bgm_res.get("file_path")

    lut_filter = color_luts.get_filter(req.plan.look)

    await broadcast_progress("render", 40, "Creating your video…", req.project_id)
    output_video = os.path.join(EXPORTS_DIR, f"{req.project_id}_quick_edit.mp4")
    loop = asyncio.get_event_loop()

    def _progress(pct: int):
        asyncio.run_coroutine_threadsafe(
            broadcast_progress("render", max(40, min(99, pct)), "Creating your video…", req.project_id),
            loop,
        )

    result = await asyncio.to_thread(
        gpu_renderer.render_final_short,
        input_video=input_video,
        output_video=output_video,
        ass_subtitle_path=ass_path if os.path.exists(ass_path) else None,
        bgm_path=bgm_file,
        color_lut_filter=lut_filter,
        keep_segments=keep_segments,
        broll_overlays=overlays,
        segment_boundaries=boundaries,
        transition_style=req.plan.transition_style,
        progress_cb=_progress,
    )

    if result.get("status") != "success":
        await broadcast_progress("render", 0, "Render failed", req.project_id)
        raise HTTPException(status_code=500, detail=f"Rendering failed: {result.get('error', 'unknown ffmpeg error')}")

    await broadcast_progress("render", 100, "Your video is ready!", req.project_id)
    return {
        "status": "success",
        "output_url": f"/exports/{req.project_id}_quick_edit.mp4",
        "local_path": output_video,
        "render_details": result,
        "notes": broll_notes,
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

    # Smart fallback: Search for the most recently uploaded video in all projects
    if os.path.exists(PROJECTS_DIR):
        all_projs = sorted(os.listdir(PROJECTS_DIR), key=lambda d: os.path.getmtime(os.path.join(PROJECTS_DIR, d)), reverse=True)
        for p_dir in all_projs:
            sub = os.path.join(PROJECTS_DIR, p_dir)
            if os.path.isdir(sub):
                for ext in [".webm", ".mp4", ".mov", ".mkv", ".avi", ".wav", ".mp3"]:
                    p = os.path.join(sub, f"raw_video{ext}")
                    if os.path.exists(p):
                        logger.info(f"Fallback matched video from recent project [{p_dir}]: {p}")
                        return p

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
    _require_nonempty(req.project_id, "project_id")
    target_video = _find_project_video(req.project_id)
    if not os.path.exists(target_video):
        raise HTTPException(status_code=404, detail=f"No uploaded media found for project '{req.project_id}'.")

    # soundfile cannot read mp4/webm containers — extract a clean 16kHz mono WAV first
    proj_path = os.path.join(PROJECTS_DIR, req.project_id)
    wav_path = os.path.join(proj_path, "vad_audio.wav")
    analyzed_path = gpu_renderer.extract_audio_wav(target_video, wav_path) or target_video

    return vad_trimmer.detect_speech_intervals(analyzed_path, min_silence_sec=req.min_silence_sec)

class FillerCleanRequest(BaseModel):
    words: List[Dict[str, Any]]

@app.post("/api/project/clean-fillers")
def clean_fillers(req: FillerCleanRequest):
    return take_optimizer.detect_fillers(req.words)

class FixTranscriptRequest(BaseModel):
    words: List[Dict[str, Any]]
    model_name: Optional[str] = DEFAULT_MODEL

@app.post("/api/project/fix-transcript")
def fix_transcript(req: FixTranscriptRequest):
    """AI-corrects misheard words in a transcript, keeping timings intact."""
    if not req.words:
        raise HTTPException(status_code=422, detail="Field 'words' must not be empty.")
    ollama_manager.ensure_running(wait_seconds=20)
    if req.model_name:
        local_ai.set_model(req.model_name)
    return local_ai.correct_transcript_words(req.words)

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
    # Auto-edit result: second ranges to KEEP. Everything between them is cut.
    keep_segments: Optional[List[Dict[str, Any]]] = None
    # User-corrected transcript words (overrides transcript.json for captions)
    transcript_words: Optional[List[Dict[str, Any]]] = None


def _merge_segments(segments: List[Dict[str, Any]], min_gap: float = 0.0) -> List[Dict[str, Any]]:
    """Sorts and merges overlapping keep segments."""
    cleaned = []
    for seg in sorted(segments, key=lambda s: float(s.get("start", 0))):
        s, e = float(seg.get("start", 0)), float(seg.get("end", 0))
        if e <= s:
            continue
        if cleaned and s - cleaned[-1]["end"] <= min_gap:
            cleaned[-1]["end"] = max(cleaned[-1]["end"], e)
        else:
            cleaned.append({"start": s, "end": e})
    return cleaned


def _make_time_remapper(keep_segments: List[Dict[str, Any]]) -> Callable[[float], float]:
    """Returns f(t) mapping an original timestamp onto the post-cut timeline."""
    def remap(t: float) -> float:
        removed = 0.0
        prev_end = 0.0
        for seg in keep_segments:
            s, e = seg["start"], seg["end"]
            if t <= s:
                return max(0.0, t - removed)
            if t <= e:
                return t - removed
            removed += (s - prev_end)
            prev_end = e
        return max(0.0, t - removed)
    return remap


@app.post("/api/project/render-nvenc")
async def render_project_nvenc(req: FullRenderRequest, background_tasks: BackgroundTasks):
    _require_nonempty(req.project_id, "project_id")
    proj_path = os.path.join(PROJECTS_DIR, req.project_id)
    if not os.path.isdir(proj_path):
        raise HTTPException(status_code=404, detail=f"Project '{req.project_id}' not found. Record or upload a video first.")
    input_video = _find_project_video(req.project_id)
    # Never silently render another project's video — the recent-project fallback
    # is only acceptable for read-only lookups like transcription retries.
    if not os.path.exists(input_video) or not os.path.abspath(input_video).startswith(os.path.abspath(proj_path) + os.sep):
        raise HTTPException(status_code=404, detail=f"No uploaded media found for project '{req.project_id}'. Record or upload a video first.")
    output_video = os.path.join(EXPORTS_DIR, f"{req.project_id}_viral_short.mp4")

    keep_segments = _merge_segments(req.keep_segments or [])
    applying_cuts = len(keep_segments) > 0

    # Load transcript (user-corrected words from the editor take priority)
    transcript_path = os.path.join(proj_path, "transcript.json")
    words = []
    if req.transcript_words:
        words = req.transcript_words
    elif os.path.exists(transcript_path):
        with open(transcript_path, "r", encoding="utf-8") as f:
            t_data = json.load(f)
            words = t_data.get("words", [])

    # 1. Generate Subtitle ASS file — when cuts are applied, word timings are
    # remapped onto the compressed timeline so captions stay in sync.
    ass_path = os.path.join(proj_path, "captions.ass")
    if words:
        if applying_cuts:
            remap = _make_time_remapper(keep_segments)
            words = [
                {**w, "start": remap(float(w.get("start", 0))), "end": remap(float(w.get("end", 0)))}
                for w in words
            ]
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

    await broadcast_progress("render", 10, "Preparing your video...", req.project_id)

    loop = asyncio.get_event_loop()

    def _render_progress(pct: int):
        # Runs on the worker thread — forward to the event loop for WebSocket broadcast
        asyncio.run_coroutine_threadsafe(
            broadcast_progress("render", max(10, min(99, pct)), "Creating your video...", req.project_id),
            loop
        )

    render_result = await asyncio.to_thread(
        gpu_renderer.render_final_short,
        input_video=input_video,
        output_video=output_video,
        ass_subtitle_path=ass_path if os.path.exists(ass_path) else None,
        bgm_path=bgm_file,
        color_lut_filter=lut_filter,
        hook_banner_filter=banner_filter,
        zoom_filter=zoom_filter,
        target_width=req.target_width,
        target_height=req.target_height,
        keep_segments=keep_segments,
        progress_cb=_render_progress
    )

    if render_result.get("status") != "success":
        await broadcast_progress("render", 0, "Render failed", req.project_id)
        raise HTTPException(status_code=500, detail=f"Video rendering failed: {render_result.get('error', 'unknown ffmpeg error')}")

    await broadcast_progress("render", 100, "Your video is ready!", req.project_id)

    return {
        "status": "success",
        "output_url": f"/exports/{req.project_id}_viral_short.mp4",
        "local_path": output_video,
        "render_details": render_result
    }
