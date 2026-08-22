// Single source of truth for the local engine URL.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export function mediaUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("blob:")) return path;
  return `${API_BASE}${path}`;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parseError(res: Response): Promise<never> {
  let message = `Request failed (${res.status})`;
  try {
    const data = await res.json();
    const detail = data?.detail;
    if (typeof detail === "string") message = detail;
    else if (detail) message = JSON.stringify(detail);
    else if (data?.message) message = data.message;
  } catch {
    // keep default message
  }
  throw new ApiError(message, res.status);
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), options);
  } catch {
    throw new ApiError(
      "Cannot reach the AutoEdit engine. Make sure the app is running (start_studio.bat).",
      0
    );
  }
  if (!res.ok) await parseError(res);
  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function uploadFile<T>(
  path: string,
  file: Blob,
  filename: string,
  projectId?: string
): Promise<T> {
  const form = new FormData();
  form.append("file", file, filename);
  if (projectId) form.append("project_id", projectId);
  return apiFetch<T>(path, { method: "POST", body: form });
}

// ---- Shared types ----

export interface BrandProfile {
  name: string;
  niche: string;
  audience: string;
  voice?: string;
  cta_goal?: string;
  youtube_url?: string;
  [key: string]: unknown;
}

export interface ScriptLine {
  line_id: number;
  spoken_text: string;
  visual_action?: string;
  emoji_highlight?: string;
  sfx?: string;
}

export interface VideoScript {
  title: string;
  visual_theme?: string;
  estimated_seconds: number;
  recommended_format?: string;
  hook: { spoken_text: string; overlay_text?: string; [key: string]: unknown };
  body_lines: ScriptLine[];
  cta: { spoken_text: string; [key: string]: unknown };
  source?: "ollama" | "offline-fallback";
  [key: string]: unknown;
}

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

export interface Transcript {
  text: string;
  language?: string;
  words: TranscriptWord[];
  [key: string]: unknown;
}

export interface KeepSegment {
  start: number;
  end: number;
}

export interface RenderRequest {
  project_id: string;
  style_name: string;
  enable_hook_banner: boolean;
  hook_banner_text: string;
  enable_punch_zoom: boolean;
  color_lut_preset: string;
  bgm_url_or_preset?: string | null;
  keep_segments?: KeepSegment[] | null;
  transcript_words?: TranscriptWord[] | null;
}

export interface UploadResult {
  status: string;
  project_id: string;
  filename: string;
  local_path: string;
  url: string;
}

export interface RenderResult {
  status: string;
  output_url: string;
  local_path: string;
  render_details: {
    encoder_used: string;
    resolution: string;
    cuts_applied?: number;
    [key: string]: unknown;
  };
}

export interface SocialPackage {
  source?: "ollama" | "offline-fallback";
  viral_titles: string[];
  seo_description: string;
  chapters: { time: string; title: string }[];
  hashtags: string[];
}

export interface HealthStatus {
  status: string;
  gpu_available: boolean;
  gpu_name: string;
  encoder: string;
  gpu_rendering: boolean;
  ollama_available: boolean;
  active_model: string;
}

/**
 * Saves a video to disk with the browser's real Save-As dialog (choose any
 * folder). Falls back to a normal download when the picker isn't available.
 */
export async function saveVideoFile(url: string, suggestedName: string): Promise<void> {
  let blob: Blob;
  try {
    blob = await (await fetch(url)).blob();
  } catch {
    window.open(url, "_blank");
    return;
  }

  const picker = (
    window as unknown as {
      showSaveFilePicker?: (opts?: unknown) => Promise<{
        createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }>;
      }>;
    }
  ).showSaveFilePicker;

  if (picker) {
    try {
      const handle = await picker({
        suggestedName,
        types: [{ description: "MP4 video", accept: { "video/mp4": [".mp4"] } }],
      });
      const stream = await handle.createWritable();
      await stream.write(blob);
      await stream.close();
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // user cancelled
      // fall through to anchor download
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}

/** Human-friendly helper for AI provenance badges. */
export function isOfflineFallback(data: { source?: string } | null | undefined): boolean {
  return data?.source === "offline-fallback";
}

// ---- Ollama model management ----

export interface OllamaStatus {
  running: boolean;
  started: boolean;
  version: string | null;
  error: string | null;
}

export interface ModelsResponse {
  status: string;
  ollama_running: boolean;
  active_model: string;
  models: { name: string }[];
}

export interface UnslothModel {
  name: string; // Ollama pull name, e.g. hf.co/unsloth/…-GGUF:Q4_K_M
  repo?: string;
  size?: string;
  downloads?: number;
  likes?: number;
  description?: string;
  installed: boolean;
}

export interface UnslothSearchResponse {
  status: string;
  source: string;
  models: UnslothModel[];
}

export function friendlyReason(reason?: string | null): string | null {
  switch (reason) {
    case "ollama_not_running":
      return "Couldn't start Ollama. Install it from ollama.com/download, then try again.";
    case "no_models_installed":
      return "No AI model installed yet. Open the model picker above and install one (smallest is under 1 GB).";
    case "model_error":
      return "The AI model took too long or failed. Try again, or pick a smaller model.";
    default:
      return null;
  }
}
