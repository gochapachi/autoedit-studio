"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  apiPost,
  uploadFile,
  mediaUrl,
  Transcript,
  UploadResult,
  KeepSegment,
} from "@/lib/api";
import { Button, Panel, ErrorBanner, SectionTitle, Spinner, EmptyState } from "@/components/ui";
import TranscriptEditor from "@/components/TranscriptEditor";

const CAPTION_STYLES = [
  { id: "hormozi", name: "Bold Yellow", swatch: "bg-yellow-400 text-black" },
  { id: "mrbeast", name: "Colorful", swatch: "bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white" },
  { id: "minimalist", name: "Clean", swatch: "bg-white text-slate-800 border border-slate-300" },
  { id: "cyberpunk", name: "Neon", swatch: "bg-slate-950 text-cyan-400 border border-cyan-500" },
];

const COLOR_LOOKS = [
  { id: "clean_studio", name: "Natural", swatch: "bg-slate-100" },
  { id: "warm_creator", name: "Warm", swatch: "bg-amber-200" },
  { id: "teal_and_orange", name: "Cinematic", swatch: "bg-gradient-to-r from-teal-400 to-orange-300" },
  { id: "vibrant_pop", name: "Vivid", swatch: "bg-gradient-to-r from-fuchsia-400 to-rose-400" },
  { id: "cyberpunk", name: "Moody", swatch: "bg-gradient-to-br from-indigo-900 to-cyan-700" },
];

interface Props {
  videoUrl: string | null;
  projectId: string | null;
  transcript: Transcript | null;
  setTranscript: (t: Transcript | null) => void;
  styleName: string;
  setStyleName: (s: string) => void;
  colorLut: string;
  setColorLut: (s: string) => void;
  bgmUrl: string | null;
  setBgmUrl: (u: string | null) => void;
  onUploaded: (projectId: string, url: string) => void;
  onKeepSegments: (segs: KeepSegment[]) => void;
  onReady: () => void;
}

export default function PolishStep({
  videoUrl,
  projectId,
  transcript,
  setTranscript,
  styleName,
  setStyleName,
  colorLut,
  setColorLut,
  bgmUrl,
  setBgmUrl,
  onUploaded,
  onKeepSegments,
  onReady,
}: Props) {
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletedIdx, setDeletedIdx] = useState<Set<number>>(new Set());
  const [fixingAI, setFixingAI] = useState(false);
  const [cleaning, setCleaning] = useState<"fillers" | "silences" | null>(null);
  const [speechIntervals, setSpeechIntervals] = useState<[number, number][] | null>(null);
  const [stats, setStats] = useState<{ fillers: number; silenceSec: number } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [bgmLoading, setBgmLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const autoStartedRef = useRef(false);

  // Auto-transcribe when a fresh take arrives
  useEffect(() => {
    if (projectId && !transcript && !transcribing && !autoStartedRef.current) {
      autoStartedRef.current = true;
      transcribe(projectId);
    }
    if (!projectId) autoStartedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, transcript]);

  async function transcribe(pid: string) {
    setTranscribing(true);
    setError(null);
    try {
      const res = await apiPost<Transcript>("/api/project/transcribe", { project_id: pid });
      if (!res.words || res.words.length === 0) {
        setError("We couldn't hear any speech in this video. Check that your microphone was on, then re-record.");
      }
      setTranscript(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcription failed.");
    } finally {
      setTranscribing(false);
    }
  }

  async function handleFileUpload(file: File) {
    setUploadingFile(true);
    setError(null);
    try {
      const res = await uploadFile<UploadResult>("/api/upload", file, file.name);
      onUploaded(res.project_id, mediaUrl(res.url));
      setTranscript(null);
      setDeletedIdx(new Set());
      setSpeechIntervals(null);
      autoStartedRef.current = false;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploadingFile(false);
    }
  }

  function fixWordText(idx: number, text: string) {
    if (!transcript?.words) return;
    const words = transcript.words.map((w, i) => (i === idx ? { ...w, word: text } : w));
    setTranscript({ ...transcript, words });
  }

  async function fixTranscriptWithAI() {
    if (!transcript?.words?.length) return;
    setFixingAI(true);
    setError(null);
    try {
      const res = await apiPost<{
        status: string;
        words?: Transcript["words"];
        error?: string;
      }>("/api/project/fix-transcript", { words: transcript.words });
      if (res.status === "success" && res.words?.length) {
        setTranscript({ ...transcript, words: res.words });
      } else {
        setError(
          res.error || "AI fix didn't work this time — switch to Fix words mode and edit them yourself."
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI transcript fix failed.");
    } finally {
      setFixingAI(false);
    }
  }

  async function removeFillers() {
    if (!transcript?.words?.length) return;
    setCleaning("fillers");
    setError(null);
    try {
      const res = await apiPost<{
        fillers_count: number;
        fillers: { word: string; start: number; end: number }[];
      }>("/api/project/clean-fillers", { words: transcript.words });
      const fillerTimes = new Set(res.fillers.map((f) => `${f.start}:${f.end}`));
      const idxs = new Set<number>();
      transcript.words.forEach((w, i) => {
        if (fillerTimes.has(`${w.start}:${w.end}`)) idxs.add(i);
      });
      setDeletedIdx((prev) => new Set([...prev, ...idxs]));
      setStats((s) => ({ ...(s || { fillers: 0, silenceSec: 0 }), fillers: res.fillers_count }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Filler cleanup failed.");
    } finally {
      setCleaning(null);
    }
  }

  async function removeSilences() {
    if (!projectId) return;
    setCleaning("silences");
    setError(null);
    try {
      const res = await apiPost<{
        speech_intervals: [number, number][];
        total_silence_cut_sec: number;
      }>("/api/project/clean-vad", { project_id: projectId });
      setSpeechIntervals(res.speech_intervals || []);
      setStats((s) => ({
        ...(s || { fillers: 0, silenceSec: 0 }),
        silenceSec: Math.round(res.total_silence_cut_sec * 10) / 10,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Silence removal failed.");
    } finally {
      setCleaning(null);
    }
  }

  // The final cut list the renderer receives: runs of kept words that also
  // fall inside detected speech (when silence-cleaning was used).
  const keepSegments: KeepSegment[] = useMemo(() => {
    const words = transcript?.words;
    if (!words?.length) return [];
    const duration = words[words.length - 1]?.end || 0;
    const inSpeech = (t: number) =>
      !speechIntervals || speechIntervals.some(([s, e]) => t >= s - 0.05 && t <= e + 0.05);

    const PAD = 0.12;
    const segs: KeepSegment[] = [];
    let cur: KeepSegment | null = null;
    words.forEach((w, i) => {
      const kept = !deletedIdx.has(i) && inSpeech(w.start);
      if (kept) {
        if (cur && w.start - cur.end < 0.4) {
          cur.end = Math.max(cur.end, w.end + PAD);
        } else {
          if (cur) segs.push(cur);
          cur = { start: Math.max(0, w.start - PAD), end: w.end + PAD };
        }
      }
    });
    if (cur) segs.push(cur);
    if (segs.length) {
      segs[segs.length - 1].end = Math.max(segs[segs.length - 1].end, duration);
    }
    return segs;
  }, [transcript, deletedIdx, speechIntervals]);

  // Publish the computed cut list upward so the export step renders with it
  useEffect(() => {
    onKeepSegments(keepSegments);
  }, [keepSegments, onKeepSegments]);

  const originalSec = transcript?.words?.length
    ? Math.max(...transcript.words.map((w) => w.end))
    : 0;
  const keptSec = keepSegments.reduce((a, s) => a + (s.end - s.start), 0);
  const savedSec = Math.max(0, originalSec - keptSec);
  const hasEdits = deletedIdx.size > 0 || speechIntervals !== null;

  function seekTo(t: number) {
    if (videoRef.current) videoRef.current.currentTime = t;
  }

  // Fix webm duration=Infinity scrubbing: force a seek to load real duration
  function fixWebmDuration(v: HTMLVideoElement) {
    if (v.duration === Infinity) {
      v.currentTime = 1e7;
      v.ontimeupdate = () => {
        v.ontimeupdate = null;
        v.currentTime = 0;
      };
    }
  }

  async function pickMusic(query: string) {
    setBgmLoading(true);
    setError(null);
    try {
      const res = await apiPost<{ status: string; file_path?: string; url?: string; error?: string }>(
        "/api/bgm/search",
        { query_or_url: query }
      );
      if (res.file_path) {
        setBgmUrl(query);
      } else {
        setError("Couldn't load that music. You can continue without it.");
      }
    } catch (e) {
      setError("Couldn't load music. You can continue without it.");
    } finally {
      setBgmLoading(false);
    }
  }

  if (!videoUrl) {
    return (
      <div className="max-w-3xl mx-auto">
        <SectionTitle step="Step 3 of 4" title="Polish your video" />
        <Panel className="p-10 mt-4">
          <EmptyState
            icon="🎬"
            title="No video yet"
            hint="Record one in Step 2, or drop an existing video file here."
          />
          <label className="block text-center">
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
              }}
            />
            <span className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 text-white font-semibold px-6 py-3.5 cursor-pointer hover:bg-indigo-700">
              {uploadingFile ? <Spinner /> : "📁"} Choose a video file
            </span>
          </label>
        </Panel>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <SectionTitle
        step="Step 3 of 4"
        title="Polish your video"
        subtitle="Tap any word to cut it from the final video. One-tap cleanup removes silences and filler words."
      />
      <ErrorBanner message={error} />

      <div className="grid lg:grid-cols-[340px_1fr] gap-6 mt-4">
        {/* Preview */}
        <Panel className="p-4 h-fit">
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            onLoadedMetadata={(e) => fixWebmDuration(e.currentTarget)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            className="w-full rounded-xl bg-black aspect-[9/16]"
          />
          {transcribing && (
            <div className="flex items-center gap-2 text-sm text-slate-500 mt-3">
              <Spinner /> Listening to your video…
            </div>
          )}
          {!transcribing && !transcript && (
            <Button variant="secondary" size="sm" className="w-full mt-3" onClick={() => projectId && transcribe(projectId)}>
              🎧 Transcribe again
            </Button>
          )}
          {hasEdits && (
            <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-700">
              ✂️ This edit will shorten your video by about{" "}
              <b>{savedSec.toFixed(1)} seconds</b>
              {stats?.fillers ? ` (${stats.fillers} filler words)` : ""}
              {stats?.silenceSec ? ` (${stats.silenceSec}s of silence)` : ""}
              <button
                className="block text-xs text-emerald-600 underline mt-1"
                onClick={() => {
                  setDeletedIdx(new Set());
                  setSpeechIntervals(null);
                  setStats(null);
                }}
              >
                Undo all cuts
              </button>
            </div>
          )}
        </Panel>

        {/* Transcript editor */}
        <div className="space-y-5">
          <Panel className="p-5">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={removeFillers}
                loading={cleaning === "fillers"}
                disabled={!transcript}
              >
                🗑 Remove “um” & “uh”
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={removeSilences}
                loading={cleaning === "silences"}
                disabled={!projectId}
              >
                🤫 Remove silences
              </Button>
            </div>

            {transcript?.words?.length ? (
              <TranscriptEditor
                words={transcript.words}
                deleted={deletedIdx}
                setDeleted={setDeletedIdx}
                currentTime={currentTime}
                onEditWord={fixWordText}
                onAIFix={fixTranscriptWithAI}
                aiFixing={fixingAI}
                hint="Tap any word to cut it from the final video. Switch to Fix words to correct subtitles."
              />
            ) : (
              <EmptyState
                icon={transcribing ? "🎧" : "📝"}
                title={transcribing ? "Transcribing…" : "Your transcript will appear here"}
                hint="Once transcribed, tap words to remove them from the final cut."
              />
            )}
          </Panel>

          <Panel className="p-5">
            <h3 className="font-bold text-slate-800 mb-1">Caption style</h3>
            <p className="text-xs text-slate-400 mb-3">
              Big animated captions are added automatically. Pick a look:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {CAPTION_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyleName(s.id)}
                  className={`rounded-xl p-3 text-center border-2 transition ${
                    styleName === s.id ? "border-indigo-500" : "border-transparent hover:border-slate-200"
                  }`}
                >
                  <div className={`rounded-lg py-3 text-sm font-black ${s.swatch}`}>Aa</div>
                  <div className="text-xs font-semibold text-slate-700 mt-1.5">{s.name}</div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <h3 className="font-bold text-slate-800 mb-1">Color look</h3>
            <p className="text-xs text-slate-400 mb-3">
              A subtle color grade for the whole video. Pick what feels right:
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {COLOR_LOOKS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setColorLut(l.id)}
                  className={`rounded-xl p-2 text-center border-2 transition ${
                    colorLut === l.id ? "border-indigo-500" : "border-transparent hover:border-slate-200"
                  }`}
                >
                  <div className={`rounded-lg h-10 ${l.swatch}`} />
                  <div className="text-xs font-semibold text-slate-700 mt-1.5">{l.name}</div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <h3 className="font-bold text-slate-800 mb-1">Background music</h3>
            <p className="text-xs text-slate-400 mb-3">
              Optional. Music is auto-lowered while you speak.
            </p>
            {bgmLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Spinner /> Finding music…
              </div>
            ) : bgmUrl ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-emerald-700 font-medium">🎵 {bgmUrl} added</span>
                <button className="text-xs text-slate-400 underline" onClick={() => setBgmUrl(null)}>
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {["upbeat", "calm", "dramatic"].map((m) => (
                  <button
                    key={m}
                    onClick={() => pickMusic(`${m} no copyright background music`)}
                    className="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm px-4 py-2 capitalize"
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </Panel>

          <Button size="lg" className="w-full" onClick={onReady}>
            Looks good → Create my video
          </Button>
        </div>
      </div>
    </div>
  );
}
