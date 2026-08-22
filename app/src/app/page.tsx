"use client";

import { useEffect, useState } from "react";
import StepperNav from "@/components/StepperNav";
import PlanStep from "@/components/PlanStep";
import RecordStep from "@/components/RecordStep";
import PolishStep from "@/components/PolishStep";
import ExportStep from "@/components/ExportStep";
import QuickEdit from "@/components/QuickEdit";
import HistoryDrawer from "@/components/HistoryDrawer";
import { apiFetch, BrandProfile, VideoScript, Transcript, KeepSegment } from "@/lib/api";

type Step = 1 | 2 | 3 | 4;
type Mode = "choose" | "guided" | "quick";

export default function AutoEditStudioPage() {
  const [mode, setMode] = useState<Mode>("choose");
  const [step, setStep] = useState<Step>(1);
  const [showHistory, setShowHistory] = useState(false);

  // Engine status (honest: only shown when the engine is reachable)
  const [engineOnline, setEngineOnline] = useState<boolean | null>(null);
  const [engineNote, setEngineNote] = useState<string>("");

  // Project state
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [topic, setTopic] = useState("");
  const [script, setScript] = useState<VideoScript | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);

  // Edit settings
  const [styleName, setStyleName] = useState("hormozi");
  const [colorLut, setColorLut] = useState("clean_studio");
  const [bgmUrl, setBgmUrl] = useState<string | null>(null);
  const [keepSegments, setKeepSegments] = useState<KeepSegment[] | null>(null);

  // AI model choice ("" = auto: first installed Ollama model)
  const [selectedModel, setSelectedModel] = useState("");

  useEffect(() => {
    apiFetch<BrandProfile>("/api/brand-brain/get")
      .then((p) => {
        if (p && p.name) setBrandProfile(p);
      })
      .catch(() => null);
    apiFetch<{ status: string; gpu_rendering: boolean; encoder: string }>("/api/health")
      .then((h) => {
        setEngineOnline(true);
        setEngineNote(h.gpu_rendering ? "Graphics card rendering: on" : "");
      })
      .catch(() => setEngineOnline(false));
  }, []);

  function handleRecordingFinished(pid: string, url: string, _localBlob: string) {
    setProjectId(pid);
    setVideoUrl(url);
    setTranscript(null); // fresh take → fresh transcript
    setKeepSegments(null);
    setStep(3);
  }

  function restart() {
    // Keep the script & topic — starting a new video usually reuses them
    setProjectId(null);
    setVideoUrl(null);
    setTranscript(null);
    setKeepSegments(null);
    setStep(script ? 2 : 1);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {mode !== "guided" && (
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black">A</div>
            <div className="leading-tight">
              <div className="font-bold text-slate-900">AutoEdit Studio</div>
              <div className="text-[11px] text-slate-400">{engineOnline === false ? "Engine offline" : engineNote || "Ready"}</div>
            </div>
            <button
              onClick={() => setMode("choose")}
              className="ml-auto text-sm text-slate-400 hover:text-slate-700"
            >
              ✕ Start over
            </button>
          </div>
        </header>
      )}

      {mode === "choose" && (
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="text-3xl font-bold text-slate-900 text-center">What do you want to do?</h1>
          <p className="text-slate-500 text-center mt-2">Everything runs on your PC — nothing is uploaded to the cloud.</p>
          <div className="grid sm:grid-cols-2 gap-5 mt-10">
            <button
              onClick={() => setMode("quick")}
              className="group rounded-2xl bg-white border-2 border-slate-200 p-8 text-left hover:border-indigo-400 hover:shadow-lg transition"
            >
              <div className="text-4xl mb-4">⚡</div>
              <h2 className="text-xl font-bold text-slate-900">Just edit my videos</h2>
              <p className="text-slate-500 text-sm mt-2">
                Upload one or more videos. The AI cuts silences &amp; mistakes, adds B-roll
                cutaways, music, transitions and color — then you fine-tune anything.
              </p>
              <span className="inline-block mt-4 text-sm font-semibold text-indigo-600 group-hover:underline">
                Start quick edit →
              </span>
            </button>
            <button
              onClick={() => { setMode("guided"); setStep(1); }}
              className="group rounded-2xl bg-white border-2 border-slate-200 p-8 text-left hover:border-indigo-400 hover:shadow-lg transition"
            >
              <div className="text-4xl mb-4">🧠</div>
              <h2 className="text-xl font-bold text-slate-900">Make a video from scratch</h2>
              <p className="text-slate-500 text-sm mt-2">
                Research a topic, write a script, record with the built-in teleprompter, then
                polish and export — guided step by step.
              </p>
              <span className="inline-block mt-4 text-sm font-semibold text-indigo-600 group-hover:underline">
                Start guided studio →
              </span>
            </button>
          </div>
        </main>
      )}

      {mode === "quick" && (
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <QuickEdit />
        </main>
      )}

      {mode === "guided" && (
        <>
      <StepperNav
        step={step}
        setStep={setStep}
        hasScript={!!script}
        hasVideo={!!videoUrl}
        engineOnline={engineOnline}
        engineNote={engineNote}
        onOpenHistory={() => setShowHistory(true)}
      />

      {engineOnline === false && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-sm text-center px-4 py-2">
          The AutoEdit engine isn&apos;t running. Close this window and start the app again with{" "}
          <b>start_studio.bat</b>.
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {step === 1 && (
          <PlanStep
            brandProfile={brandProfile}
            topic={topic}
            onTopicChange={setTopic}
            script={script}
            onScriptReady={(s) => {
              setScript(s);
              setStep(2);
            }}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
          />
        )}

        {step === 2 && (
          <RecordStep script={script} onFinish={handleRecordingFinished} />
        )}

        {step === 3 && (
          <PolishStep
            videoUrl={videoUrl}
            projectId={projectId}
            transcript={transcript}
            setTranscript={setTranscript}
            styleName={styleName}
            setStyleName={setStyleName}
            colorLut={colorLut}
            setColorLut={setColorLut}
            bgmUrl={bgmUrl}
            setBgmUrl={setBgmUrl}
            onUploaded={(pid, url) => {
              setProjectId(pid);
              setVideoUrl(url);
            }}
            onKeepSegments={setKeepSegments}
            onReady={() => setStep(4)}
          />
        )}

        {step === 4 && (
          <ExportStep
            projectId={projectId}
            videoUrl={videoUrl}
            styleName={styleName}
            colorLut={colorLut}
            bgmUrl={bgmUrl}
            keepSegments={keepSegments}
            transcript={transcript}
            script={script}
            onBack={() => setStep(3)}
            onRestart={restart}
          />
        )}
      </main>

      <HistoryDrawer
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onSelectTopic={(t) => {
          setTopic(t);
          setShowHistory(false);
          setStep(1);
        }}
        onLoadScript={(s) => {
          setScript(s);
          setShowHistory(false);
          setStep(2);
        }}
      />
        </>
      )}
    </div>
  );
}
