"use client";

import { useEffect, useState } from "react";
import {
  apiPost,
  API_BASE,
  mediaUrl,
  saveVideoFile,
  RenderRequest,
  RenderResult,
  VideoScript,
  Transcript,
  SocialPackage,
  isOfflineFallback,
} from "@/lib/api";
import { Button, Panel, ErrorBanner, SectionTitle, OfflineBadge, Spinner } from "@/components/ui";

interface Props {
  projectId: string | null;
  videoUrl: string | null;
  styleName: string;
  colorLut: string;
  bgmUrl: string | null;
  keepSegments: { start: number; end: number }[] | null;
  transcript: Transcript | null;
  script: VideoScript | null;
  onBack: () => void;
  onRestart: () => void;
}

type Phase = "idle" | "rendering" | "done" | "error";

export default function ExportStep({
  projectId,
  videoUrl,
  styleName,
  colorLut,
  bgmUrl,
  keepSegments,
  transcript,
  script,
  onBack,
  onRestart,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [result, setResult] = useState<RenderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [social, setSocial] = useState<SocialPackage | null>(null);
  const [loadingSocial, setLoadingSocial] = useState(false);

  // Live render progress over WebSocket (falls back silently to polling UI)
  useEffect(() => {
    if (phase !== "rendering") return;
    let ws: WebSocket | null = null;
    try {
      const wsUrl = API_BASE.replace(/^http/, "ws") + "/ws/progress";
      ws = new WebSocket(wsUrl);
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (typeof data.percentage === "number") {
            setProgress((p) => Math.max(p, data.percentage));
            if (data.message) setProgressMsg(data.message);
          }
        } catch {
          // ignore malformed frames
        }
      };
    } catch {
      // progress bar still moves via render completion
    }
    return () => ws?.close();
  }, [phase]);

  async function startRender() {
    if (!projectId) {
      setError("No video found. Go back and record or upload one first.");
      return;
    }
    setPhase("rendering");
    setProgress(5);
    setProgressMsg("Preparing your video…");
    setError(null);
    try {
      const body: RenderRequest = {
        project_id: projectId,
        style_name: styleName,
        enable_hook_banner: true,
        hook_banner_text: String(script?.hook?.overlay_text || script?.hook?.spoken_text || "").slice(0, 60),
        enable_punch_zoom: true,
        color_lut_preset: colorLut,
        bgm_url_or_preset: bgmUrl || null,
        keep_segments: keepSegments && keepSegments.length ? keepSegments : null,
        transcript_words: transcript?.words?.length ? transcript.words : null,
      };
      const res = await apiPost<RenderResult>("/api/project/render-nvenc", body);
      setResult(res);
      setProgress(100);
      setProgressMsg("Your video is ready!");
      setPhase("done");
      loadSocial();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rendering failed.");
      setPhase("error");
    }
  }

  async function loadSocial() {
    const scriptText = script
      ? [script.hook?.spoken_text, ...script.body_lines.map((l) => l.spoken_text), script.cta?.spoken_text]
          .filter(Boolean)
          .join("\n")
      : "";
    if (!scriptText) return;
    setLoadingSocial(true);
    try {
      const res = await apiPost<SocialPackage>("/api/local-ai/social-copy", {
        script_text: scriptText,
        business_name: "",
      });
      setSocial(res);
    } catch {
      // social copy is optional polish
    } finally {
      setLoadingSocial(false);
    }
  }

  const outputUrl = result ? mediaUrl(result.output_url) : null;

  // Opens the browser's Save-As dialog so the user can pick the folder
  async function downloadVideo() {
    if (!outputUrl) return;
    await saveVideoFile(outputUrl, "my-video.mp4");
  }

  return (
    <div className="max-w-3xl mx-auto">
      <SectionTitle
        step="Step 4 of 4"
        title="Create your video"
        subtitle="We'll add captions, cuts, and music — using your graphics card for a fast finish."
      />
      <ErrorBanner message={error} />

      <Panel className="p-8 mt-4 text-center">
        {phase === "idle" && (
          <>
            <div className="text-5xl mb-4">✨</div>
            <p className="text-slate-600 mb-1">
              Everything is set. Your final video will be vertical Full HD (1080×1920) —
              ready for YouTube Shorts, Reels, and TikTok.
            </p>
            {keepSegments && keepSegments.length > 0 && (
              <p className="text-slate-400 text-sm mb-4">
                Your edits ({keepSegments.length} cuts) will be applied.
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
              <Button size="lg" onClick={startRender}>
                🎬 Create my video
              </Button>
              <Button variant="secondary" size="lg" onClick={onBack}>
                ← Back to editing
              </Button>
            </div>
          </>
        )}

        {phase === "rendering" && (
          <div className="py-6">
            <Spinner className="!h-8 !w-8 text-indigo-600 mx-auto mb-4" />
            <div className="max-w-sm mx-auto h-3 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-slate-500 text-sm mt-3">
              {progressMsg || "Working…"} {progress}%
            </p>
            <p className="text-slate-400 text-xs mt-1">
              This usually takes under a minute. Keep this window open.
            </p>
          </div>
        )}

        {phase === "done" && outputUrl && (
          <div>
            <div className="text-5xl mb-3">🎉</div>
            <h3 className="text-xl font-bold text-slate-900">Your video is ready!</h3>
            <p className="text-slate-500 text-sm mt-1 mb-5">
              {result?.render_details?.resolution} · rendered on your{" "}
              {result?.render_details?.encoder_used?.includes("nvenc") ? "graphics card" : "CPU"}
              {result?.render_details?.cuts_applied
                ? ` · ${result.render_details.cuts_applied} edits applied`
                : ""}
            </p>
            <video
              src={outputUrl}
              controls
              className="w-56 mx-auto rounded-2xl bg-black aspect-[9/16] mb-5"
            />
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" onClick={downloadVideo}>
                ⬇️ Download video
              </Button>
              <Button variant="secondary" size="lg" onClick={onBack}>
                ← Back to editing
              </Button>
              <Button variant="ghost" size="lg" onClick={onRestart}>
                🔄 New video
              </Button>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div>
            <div className="text-5xl mb-3">😕</div>
            <p className="text-slate-600 mb-4">
              Something went wrong while creating your video. Your recording is safe — try again.
            </p>
            <Button size="lg" onClick={startRender}>
              Try again
            </Button>
          </div>
        )}
      </Panel>

      {phase === "done" && (social || loadingSocial) && (
        <Panel className="p-6 mt-6 text-left">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h3 className="font-bold text-slate-900">Post-ready text</h3>
            <OfflineBadge show={isOfflineFallback(social)} />
          </div>
          {loadingSocial ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner /> Writing titles & hashtags…
            </div>
          ) : social ? (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase mb-1.5">Pick a title</p>
                <ul className="space-y-1">
                  {social.viral_titles?.map((t, i) => (
                    <li key={i} className="text-slate-700">• {t}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase mb-1.5">Description</p>
                <p className="text-slate-600 whitespace-pre-wrap">{social.seo_description}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase mb-1.5">Hashtags</p>
                <p className="text-indigo-600">{social.hashtags?.join(" ")}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  navigator.clipboard?.writeText(
                    `${social.viral_titles?.[0] || ""}\n\n${social.seo_description}\n\n${social.hashtags?.join(" ")}`
                  )
                }
              >
                📋 Copy all
              </Button>
            </div>
          ) : null}
        </Panel>
      )}
    </div>
  );
}
