"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  apiPost,
  apiFetch,
  uploadFile,
  saveVideoFile,
  API_BASE,
  mediaUrl,
  UploadResult,
  Transcript,
} from "@/lib/api";
import { Button, Panel, ErrorBanner, SectionTitle, Spinner } from "@/components/ui";
import TranscriptEditor from "@/components/TranscriptEditor";

interface BrollSlot {
  id: string;
  start: number;
  end: number;
  keyword: string;
  reason?: string;
  source: string;
  user_file?: string | null;
  user_name?: string | null;
}

interface EditPlan {
  timeline: {
    total_duration: number;
    edited_duration?: number;
    silence_cut_sec?: number;
    fillers_removed?: number;
    keep_segments: { start: number; end: number }[];
  };
  layers: {
    brolls: BrollSlot[];
    captions: { enabled: boolean; style: string };
    music: { enabled: boolean; mood: string };
    grade: { look: string };
    transitions: { style: string };
    visual_provider?: string;
  };
  source?: string;
}

interface ProviderInfo {
  id: string;
  name: string;
  available: boolean;
  note: string;
}

type Stage = "upload" | "analyzing" | "plan" | "rendering" | "done";

const MOODS = ["upbeat", "calm", "dramatic"];
const LOOKS = [
  { id: "clean_studio", name: "Natural", swatch: "bg-slate-100" },
  { id: "warm_creator", name: "Warm", swatch: "bg-amber-200" },
  { id: "teal_and_orange", name: "Cinematic", swatch: "bg-gradient-to-r from-teal-400 to-orange-300" },
  { id: "vibrant_pop", name: "Vivid", swatch: "bg-gradient-to-r from-fuchsia-400 to-rose-400" },
  { id: "cyberpunk", name: "Moody", swatch: "bg-gradient-to-br from-indigo-900 to-cyan-700" },
];
const CAPTION_STYLES = [
  { id: "hormozi", name: "Bold Yellow" },
  { id: "mrbeast", name: "Colorful" },
  { id: "minimalist", name: "Clean" },
  { id: "cyberpunk", name: "Neon" },
];
const TRANSITIONS = [
  { id: "dip", name: "Seamless", hint: "Soft dip between cuts" },
  { id: "cut", name: "Hard cuts", hint: "Punchy, fast-paced" },
  { id: "flash", name: "Flash", hint: "White flash on cuts" },
];

export default function QuickEdit() {
  const [stage, setStage] = useState<Stage>("upload");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [plan, setPlan] = useState<EditPlan | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [deletedWords, setDeletedWords] = useState<Set<number>>(new Set());
  const [editedWords, setEditedWords] = useState<Transcript["words"]>([]);
  const [fixingAI, setFixingAI] = useState(false);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [planSource, setPlanSource] = useState<string>("");
  const startedRef = useRef(false);

  // Live progress from the engine (WebSocket)
  useEffect(() => {
    if (stage !== "analyzing" && stage !== "rendering") return;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(API_BASE.replace(/^http/, "ws") + "/ws/progress");
      ws.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data);
          if (typeof d.percentage === "number") {
            setProgress((p) => Math.max(p, d.percentage));
            if (d.message) setProgressMsg(d.message);
          }
        } catch { /* ignore */ }
      };
    } catch { /* bar still completes via HTTP */ }
    return () => ws?.close();
  }, [stage]);

  async function handleFiles(selected: FileList) {
    setUploading(true);
    setError(null);
    try {
      let pid = projectId;
      const names: string[] = [];
      for (const file of Array.from(selected)) {
        const res = await uploadFile<UploadResult>("/api/upload", file, file.name, pid || undefined);
        pid = res.project_id;
        names.push(file.name);
      }
      setProjectId(pid);
      setFiles((f) => [...f, ...names]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    if (stage !== "plan") return;
    apiFetch<{ providers: ProviderInfo[] }>("/api/quickedit/providers")
      .then((r) => setProviders(r.providers))
      .catch(() => setProviders([]));
  }, [stage]);

  async function analyze() {
    if (!projectId) return;
    startedRef.current = true;
    setStage("analyzing");
    setProgress(5);
    setError(null);
    try {
      const res = await apiPost<{ status: string; plan: EditPlan; transcript: Transcript }>(
        "/api/quickedit/analyze",
        { project_id: projectId }
      );
      setPlan(res.plan);
      setTranscript(res.transcript);
      setEditedWords(res.transcript.words || []);
      setDeletedWords(new Set());
      setPlanSource(res.plan.source || "");
      setStage("plan");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
      setStage("plan");
    }
  }

  async function render() {
    if (!projectId || !plan) return;
    setStage("rendering");
    setProgress(5);
    setError(null);
    try {
      const res = await apiPost<{ status: string; output_url: string }>(
        "/api/quickedit/render",
        {
          project_id: projectId,
          plan: {
            keep_segments: userKeepSegments || plan.timeline.keep_segments,
            brolls: plan.layers.brolls,
            caption_style: plan.layers.captions.style,
            captions_enabled: plan.layers.captions.enabled,
            music_enabled: plan.layers.music.enabled,
            music_mood: plan.layers.music.mood,
            look: plan.layers.grade.look,
            transition_style: plan.layers.transitions.style,
            visual_provider: plan.layers.visual_provider || "cards",
            transcript_words: editedWords.length ? editedWords : null,
          },
        }
      );
      setResultUrl(mediaUrl(res.output_url));
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rendering failed.");
      setStage("plan");
    }
  }

  async function download() {
    if (!resultUrl) return;
    await saveVideoFile(resultUrl, "my-edited-video.mp4");
  }

  function fixWordText(idx: number, text: string) {
    setEditedWords((ws) => ws.map((w, i) => (i === idx ? { ...w, word: text } : w)));
  }

  async function fixTranscriptWithAI() {
    if (!editedWords.length) return;
    setFixingAI(true);
    setError(null);
    try {
      const res = await apiPost<{ status: string; words?: Transcript["words"]; error?: string }>(
        "/api/project/fix-transcript",
        { words: editedWords }
      );
      if (res.status === "success" && res.words?.length) {
        setEditedWords(res.words);
      } else {
        setError(res.error || "AI fix didn't work this time — fix words manually instead.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI transcript fix failed.");
    } finally {
      setFixingAI(false);
    }
  }

  // When the user deletes words, those cuts override the auto-planned cuts
  const userKeepSegments = useMemo(() => {
    if (!editedWords.length || deletedWords.size === 0) return null;
    const PAD = 0.12;
    const segs: { start: number; end: number }[] = [];
    let cur: { start: number; end: number } | null = null;
    editedWords.forEach((w, i) => {
      const kept = !deletedWords.has(i);
      if (kept) {
        if (cur && w.start - cur.end < 0.4) cur.end = Math.max(cur.end, w.end + PAD);
        else {
          if (cur) segs.push(cur);
          cur = { start: Math.max(0, w.start - PAD), end: w.end + PAD };
        }
      }
    });
    if (cur) segs.push(cur);
    return segs.length ? segs : null;
  }, [editedWords, deletedWords]);

  function addBrollSlot() {
    setPlan((p) => {
      if (!p) return p;
      const mid = Math.max(1, Math.round((p.timeline.total_duration || 10) / 2));
      const id = `broll_custom_${Date.now() % 100000}`;
      return {
        ...p,
        layers: {
          ...p.layers,
          brolls: [
            ...p.layers.brolls,
            { id, start: mid, end: mid + 2, keyword: "your keyword", source: "generated" },
          ],
        },
      };
    });
  }

  async function attachUserBroll(slotId: string, file: File) {
    if (!projectId) return;
    try {
      const res = await uploadFile<UploadResult>("/api/upload", file, file.name, projectId);
      setPlan((p) =>
        p
          ? {
              ...p,
              layers: {
                ...p.layers,
                brolls: p.layers.brolls.map((b) =>
                  b.id === slotId
                    ? { ...b, user_file: res.local_path, user_name: file.name, source: "user" }
                    : b
                ),
              },
            }
          : p
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not attach that video.");
    }
  }

  const busy = stage === "analyzing" || stage === "rendering";

  return (
    <div className="max-w-3xl mx-auto">
      <SectionTitle
        title="Just edit my videos"
        subtitle="Drop in one or more videos. The AI editor cuts the dead air, adds B-roll cutaways, music, transitions and color — then you can tweak everything."
      />
      <ErrorBanner message={error} />

      {/* ---- Upload ---- */}
      {stage === "upload" && (
        <Panel className="p-8 mt-4 text-center">
          <div className="text-5xl mb-4">🎬</div>
          <p className="text-slate-600 mb-6">Upload the video (or videos) you want edited.</p>
          <label className="block">
            <input
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) handleFiles(e.target.files);
              }}
            />
            <span className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 text-white font-semibold px-6 py-3.5 cursor-pointer hover:bg-indigo-700">
              {uploading ? <Spinner /> : "📁"} Choose videos
            </span>
          </label>
          {files.length > 0 && (
            <div className="mt-6 text-left">
              <p className="text-sm font-semibold text-slate-700 mb-2">
                {files.length} video{files.length > 1 ? "s" : ""} ready:
              </p>
              <ul className="text-sm text-slate-500 space-y-1">
                {files.map((f, i) => (
                  <li key={i}>• {f}</li>
                ))}
              </ul>
              <div className="flex gap-3 mt-4 justify-center">
                <Button size="lg" onClick={analyze} disabled={uploading}>
                  ✨ Auto-edit my video{files.length > 1 ? "s" : ""}
                </Button>
                <label>
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) handleFiles(e.target.files);
                    }}
                  />
                  <span className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold px-5 py-3.5 cursor-pointer hover:border-indigo-300">
                    + Add more
                  </span>
                </label>
              </div>
            </div>
          )}
        </Panel>
      )}

      {/* ---- Progress ---- */}
      {busy && (
        <Panel className="p-10 mt-4 text-center">
          <Spinner className="!h-8 !w-8 text-indigo-600 mx-auto mb-4" />
          <div className="max-w-sm mx-auto h-3 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-slate-500 text-sm mt-3">{progressMsg || "Working…"} {progress}%</p>
        </Panel>
      )}

      {/* ---- Editable plan ---- */}
      {stage === "plan" && plan && (
        <div className="space-y-5 mt-4">
          <Panel className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold text-slate-900">Your auto-edit plan</h3>
              {planSource === "offline-fallback" && (
                <span className="text-xs text-amber-600 font-medium">
                  Basic mode plan — start Ollama for smarter choices
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-center">
              <Stat label="Original" value={`${Math.round(plan.timeline.total_duration)}s`} />
              <Stat
                label="After cuts"
                value={`${Math.round(plan.timeline.edited_duration || plan.timeline.total_duration)}s`}
              />
              <Stat label="Silence cut" value={`${plan.timeline.silence_cut_sec || 0}s`} />
              <Stat label="Fillers removed" value={`${plan.timeline.fillers_removed || 0}`} />
            </div>
          </Panel>

          {/* B-rolls */}
          <Panel className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
              <h3 className="font-bold text-slate-800">B-roll cutaways</h3>
              {providers.some((p) => p.id.startsWith("wgp_") && p.available) && (
                <span className="text-[11px] text-slate-400">⚡ AI generation runs locally via Wan2GP</span>
              )}
            </div>
            {providers.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-slate-400 mb-2">How should B-roll visuals be made?</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {providers.map((p) => (
                    <button
                      key={p.id}
                      disabled={!p.available}
                      onClick={() =>
                        setPlan((pl) =>
                          pl
                            ? { ...pl, layers: { ...pl.layers, visual_provider: p.id } }
                            : pl
                        )
                      }
                      className={`text-left rounded-xl border-2 p-3 transition ${
                        (plan.layers.visual_provider || "cards") === p.id
                          ? "border-indigo-500 bg-indigo-50"
                          : p.available
                          ? "border-slate-200 hover:border-slate-300"
                          : "border-slate-100 opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <div className="text-sm font-semibold text-slate-800">{p.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {p.available ? p.note : "Not available on this PC"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-slate-400 mb-3">
              The AI places animated keyword cards over key moments. Swap in your own footage or
              remove any you don&apos;t like.
            </p>
            <div className="space-y-3">
              {plan.layers.brolls.map((b) => (
                <div key={b.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={b.start}
                        onChange={(e) =>
                          setPlan((p) =>
                            p
                              ? {
                                  ...p,
                                  layers: {
                                    ...p.layers,
                                    brolls: p.layers.brolls.map((x) =>
                                      x.id === b.id
                                        ? { ...x, start: Number(e.target.value) || 0 }
                                        : x
                                    ),
                                  },
                                }
                              : p
                          )
                        }
                        className="w-16 rounded border border-slate-200 px-1.5 py-0.5 font-mono"
                      />
                      →
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={b.end}
                        onChange={(e) =>
                          setPlan((p) =>
                            p
                              ? {
                                  ...p,
                                  layers: {
                                    ...p.layers,
                                    brolls: p.layers.brolls.map((x) =>
                                      x.id === b.id
                                        ? { ...x, end: Number(e.target.value) || 0 }
                                        : x
                                    ),
                                  },
                                }
                              : p
                          )
                        }
                        className="w-16 rounded border border-slate-200 px-1.5 py-0.5 font-mono"
                      />
                      s
                    </span>
                    <input
                      value={b.keyword}
                      onChange={(e) =>
                        setPlan((p) =>
                          p
                            ? {
                                ...p,
                                layers: {
                                  ...p.layers,
                                  brolls: p.layers.brolls.map((x) =>
                                    x.id === b.id ? { ...x, keyword: e.target.value } : x
                                  ),
                                },
                              }
                            : p
                        )
                      }
                      className="flex-1 min-w-[140px] rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    />
                    <label className="text-xs text-indigo-600 font-semibold cursor-pointer">
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) attachUserBroll(b.id, f);
                        }}
                      />
                      {b.source === "user" ? `🎬 ${b.user_name || "Your video"} (change)` : "🎬 Use my video"}
                    </label>
                    <button
                      onClick={() =>
                        setPlan((p) =>
                          p
                            ? {
                                ...p,
                                layers: {
                                  ...p.layers,
                                  brolls: p.layers.brolls.filter((x) => x.id !== b.id),
                                },
                              }
                            : p
                        )
                      }
                      className="text-xs text-rose-500 font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                  {b.reason && <p className="text-xs text-slate-400 mt-1.5">{b.reason}</p>}
                </div>
              ))}
              {plan.layers.brolls.length === 0 && (
                <p className="text-sm text-slate-400">No B-roll moments — the AI kept it simple.</p>
              )}
              <Button variant="secondary" size="sm" className="mt-3" onClick={addBrollSlot}>
                + Add B-roll cutaway
              </Button>
            </div>
          </Panel>

          {/* Review cuts & subtitles */}
          <Panel className="p-5">
            <h3 className="font-bold text-slate-800 mb-1">Fine-tune cuts &amp; subtitles</h3>
            <p className="text-xs text-slate-400 mb-3">
              The final say is yours: tap words to cut them from the video, or fix any
              misheard subtitle text. Your cuts override the automatic ones.
            </p>
            {userKeepSegments && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-700 mb-3">
                ✂️ Your word cuts ({deletedWords.size} words) will be used instead of the
                automatic silence cuts.
              </div>
            )}
            <TranscriptEditor
              words={editedWords}
              deleted={deletedWords}
              setDeleted={setDeletedWords}
              onEditWord={fixWordText}
              onAIFix={fixTranscriptWithAI}
              aiFixing={fixingAI}
            />
          </Panel>

          {/* Music / transitions / look / captions */}
          <Panel className="p-5 space-y-5">
            <Choice
              title="Music"
              options={MOODS}
              selected={plan.layers.music.mood}
              onSelect={(mood) =>
                setPlan((p) =>
                  p ? { ...p, layers: { ...p.layers, music: { enabled: true, mood } } } : p
                )
              }
              extra={
                <Toggle
                  label="Music on"
                  checked={plan.layers.music.enabled}
                  onChange={(v) =>
                    setPlan((p) =>
                      p
                        ? { ...p, layers: { ...p.layers, music: { ...p.layers.music, enabled: v } } }
                        : p
                    )
                  }
                />
              }
            />
            <Choice
              title="Transitions"
              options={TRANSITIONS.map((t) => t.id)}
              labels={Object.fromEntries(TRANSITIONS.map((t) => [t.id, t.name]))}
              selected={plan.layers.transitions.style}
              onSelect={(style) =>
                setPlan((p) =>
                  p
                    ? { ...p, layers: { ...p.layers, transitions: { style } } }
                    : p
                )
              }
            />
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-slate-700">Color look</h4>
                <Toggle
                  label="Captions on"
                  checked={plan.layers.captions.enabled}
                  onChange={(v) =>
                    setPlan((p) =>
                      p
                        ? {
                            ...p,
                            layers: { ...p.layers, captions: { ...p.layers.captions, enabled: v } },
                          }
                        : p
                    )
                  }
                />
              </div>
              <div className="grid grid-cols-5 gap-2">
                {LOOKS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() =>
                      setPlan((p) =>
                        p ? { ...p, layers: { ...p.layers, grade: { look: l.id } } } : p
                      )
                    }
                    className={`rounded-xl p-1.5 border-2 transition ${
                      plan.layers.grade.look === l.id
                        ? "border-indigo-500"
                        : "border-transparent hover:border-slate-200"
                    }`}
                  >
                    <div className={`rounded-lg h-8 ${l.swatch}`} />
                    <div className="text-[11px] font-semibold text-slate-600 mt-1">{l.name}</div>
                  </button>
                ))}
              </div>
              {plan.layers.captions.enabled && (
                <div className="flex gap-2 mt-3">
                  {CAPTION_STYLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() =>
                        setPlan((p) =>
                          p
                            ? {
                                ...p,
                                layers: {
                                  ...p.layers,
                                  captions: { ...p.layers.captions, style: s.id },
                                },
                              }
                            : p
                        )
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        plan.layers.captions.style === s.id
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Panel>

          <Button size="lg" className="w-full" onClick={render}>
            🎬 Create my edited video
          </Button>
        </div>
      )}

      {/* ---- Done ---- */}
      {stage === "done" && resultUrl && (
        <Panel className="p-8 mt-4 text-center">
          <div className="text-5xl mb-3">🎉</div>
          <h3 className="text-xl font-bold text-slate-900">Your edited video is ready!</h3>
          <video src={resultUrl} controls className="w-56 mx-auto rounded-2xl bg-black aspect-[9/16] my-5" />
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={download}>
              ⬇️ Download video
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setStage("plan")}>
              ← Tweak the edit
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-lg font-bold text-slate-800">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-indigo-600"
      />
      {label}
    </label>
  );
}

function Choice({
  title,
  options,
  labels,
  selected,
  onSelect,
  extra,
}: {
  title: string;
  options: string[];
  labels?: Record<string, string>;
  selected: string;
  onSelect: (v: string) => void;
  extra?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold text-slate-700">{title}</h4>
        {extra}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onSelect(o)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize transition ${
              selected === o ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {labels?.[o] || o}
          </button>
        ))}
      </div>
    </div>
  );
}
