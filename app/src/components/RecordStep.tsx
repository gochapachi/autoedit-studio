"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { VideoScript, uploadFile, mediaUrl, UploadResult } from "@/lib/api";
import { Button, Panel, ErrorBanner, SectionTitle } from "@/components/ui";
import Teleprompter from "@/components/Teleprompter";

type RecordMode = "screen_camera" | "screen_only" | "camera_only";

const MODES: { id: RecordMode; label: string; icon: string; hint: string }[] = [
  { id: "screen_camera", label: "Screen + camera", icon: "🖥️", hint: "Best for demos & tutorials" },
  { id: "camera_only", label: "Camera only", icon: "🧑", hint: "Talking straight to camera" },
  { id: "screen_only", label: "Screen only", icon: "🖥️", hint: "No face on screen" },
];

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const FPS = 30;

// A dedicated worker timer keeps pushing frames even when this tab is in the
// background — rAF would freeze the recording the moment you switch apps.
const TICK_WORKER_SRC = `
  let timer = null;
  self.onmessage = (e) => {
    clearInterval(timer);
    timer = null;
    if (!e.data || e.data.stop) return;
    timer = setInterval(() => self.postMessage("tick"), e.data.interval || 33);
  };
`;

interface Props {
  script: VideoScript | null;
  onFinish: (projectId: string, videoUrl: string, localBlobUrl: string) => void;
}

export default function RecordStep({ script, onFinish }: Props) {
  const [mode, setMode] = useState<RecordMode>("screen_camera");
  const [devicesReady, setDevicesReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [camDevices, setCamDevices] = useState<MediaDeviceInfo[]>([]);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState<string>("");
  const [micId, setMicId] = useState<string>("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasSystemAudio, setHasSystemAudio] = useState<boolean | null>(null);
  const [showPractice, setShowPractice] = useState(false);
  const [startingShare, setStartingShare] = useState(false);

  // Prompter state
  const [prompterPlaying, setPrompterPlaying] = useState(false);
  const [prompterSpeed, setPrompterSpeed] = useState(140);
  const prompterBoxRef = useRef<HTMLDivElement>(null);

  // Media refs — one owner each
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const camVideoRef = useRef<HTMLVideoElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const videoTrackRef = useRef<CanvasCaptureMediaStreamTrack | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);
  const lastTickRef = useRef<number>(0);
  const modeRef = useRef<RecordMode>(mode);
  modeRef.current = mode;

  const prompterText = script
    ? [
        script.hook?.spoken_text,
        ...script.body_lines.map((l) => l.spoken_text),
        script.cta?.spoken_text,
      ]
        .filter(Boolean)
        .join("\n\n")
    : "";

  // ---- Compositor: draws the 9:16 frame; called from the worker ticker ----
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const screen = screenVideoRef.current;
    const cam = camVideoRef.current;
    const m = modeRef.current;

    if (m !== "camera_only" && screen && screen.videoWidth > 0) {
      const scale = CANVAS_W / screen.videoWidth;
      const h = screen.videoHeight * scale;
      ctx.drawImage(screen, 0, (CANVAS_H - h) / 2, CANVAS_W, h);
    }

    if (m === "camera_only" && cam && cam.videoWidth > 0) {
      const scale = Math.max(CANVAS_W / cam.videoWidth, CANVAS_H / cam.videoHeight);
      const w = cam.videoWidth * scale;
      const h = cam.videoHeight * scale;
      ctx.drawImage(cam, (CANVAS_W - w) / 2, (CANVAS_H - h) / 2, w, h);
    } else if (m === "screen_camera" && cam && cam.videoWidth > 0) {
      const r = 190;
      const cx = CANVAS_W - r - 90;
      const cy = CANVAS_H - r - 220;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      const side = Math.min(cam.videoWidth, cam.videoHeight);
      ctx.drawImage(
        cam,
        (cam.videoWidth - side) / 2,
        (cam.videoHeight - side) / 2,
        side,
        side,
        cx - r,
        cy - r,
        r * 2,
        r * 2
      );
      ctx.restore();
      ctx.lineWidth = 8;
      ctx.strokeStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, []);

  const startTicker = useCallback(() => {
    if (workerRef.current) return;
    try {
      const blob = new Blob([TICK_WORKER_SRC], { type: "application/javascript" });
      const worker = new Worker(URL.createObjectURL(blob));
      worker.onmessage = () => {
        drawFrame();
        // Push the freshly drawn frame into the recording stream
        try {
          videoTrackRef.current?.requestFrame();
        } catch {
          // track may be terminated right after stop
        }
      };
      worker.postMessage({ interval: Math.round(1000 / FPS) });
      workerRef.current = worker;
    } catch {
      // Worker unavailable: fall back to setInterval (1fps when backgrounded)
      const id = setInterval(() => {
        drawFrame();
        try {
          videoTrackRef.current?.requestFrame();
        } catch { /* ignore */ }
      }, Math.round(1000 / FPS));
      workerRef.current = { terminate: () => clearInterval(id) } as unknown as Worker;
    }
  }, [drawFrame]);

  const stopTicker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  const stopLevelMeter = useCallback(() => {
    if (levelTimerRef.current) clearInterval(levelTimerRef.current);
    levelTimerRef.current = null;
    setAudioLevel(0);
  }, []);

  const startLevelMeter = useCallback(() => {
    const ctx = audioCtxRef.current;
    const mic = micStreamRef.current;
    if (!ctx || !mic) return;
    try {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(mic).connect(analyser); // meter only — never to speakers
      const buf = new Uint8Array(analyser.fftSize);
      levelTimerRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        setAudioLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3));
      }, 120);
    } catch {
      // meter is best-effort
    }
  }, []);

  const cleanupRecordingMedia = useCallback(() => {
    stopTicker();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
    videoTrackRef.current = null;
    setHasSystemAudio(null);
    setPrompterPlaying(false);
  }, [stopTicker]);

  const releaseDevices = useCallback(() => {
    stopLevelMeter();
    audioCtxRef.current?.close().catch(() => null);
    audioCtxRef.current = null;
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    if (camVideoRef.current) camVideoRef.current.srcObject = null;
    setDevicesReady(false);
    setCamDevices([]);
    setMicDevices([]);
  }, [stopLevelMeter]);

  useEffect(() => {
    return () => {
      cleanupRecordingMedia();
      releaseDevices();
      recorderRef.current?.state === "recording" && recorderRef.current.stop();
    };
  }, [cleanupRecordingMedia, releaseDevices]);

  async function refreshDeviceLists() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCamDevices(devices.filter((d) => d.kind === "videoinput"));
      setMicDevices(devices.filter((d) => d.kind === "audioinput"));
    } catch {
      // ignore
    }
  }

  async function attachCamera(id?: string) {
    const constraints: MediaStreamConstraints = {
      video: id ? { deviceId: { exact: id } } : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      audio: false,
    };
    const cam = await navigator.mediaDevices.getUserMedia(constraints);
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current = cam;
    if (camVideoRef.current) {
      camVideoRef.current.srcObject = cam;
      await camVideoRef.current.play().catch(() => null);
    }
  }

  async function attachMic(id?: string) {
    const mic = await navigator.mediaDevices.getUserMedia({
      audio: id ? { deviceId: { exact: id } } : true,
    });
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = mic;
    if (audioCtxRef.current?.state === "suspended") {
      await audioCtxRef.current.resume().catch(() => null);
    }
    stopLevelMeter();
    startLevelMeter();
  }

  // Step 1: permission + device selection BEFORE any recording
  async function turnOnDevices() {
    setError(null);
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      await attachCamera(camId || undefined);
      await attachMic(micId || undefined);
      await refreshDeviceLists();
      setDevicesReady(true);
      startTicker(); // live viewfinder
    } catch (e) {
      releaseDevices();
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("denied")
          ? "We need camera/microphone permission. Allow access in your browser (camera icon in the address bar) and try again."
          : `Could not start camera/microphone: ${msg}`
      );
    }
  }

  async function switchCamera(id: string) {
    setCamId(id);
    try {
      await attachCamera(id);
    } catch (e) {
      setError(e instanceof Error ? `Could not switch camera: ${e.message}` : "Could not switch camera.");
    }
  }

  async function switchMic(id: string) {
    setMicId(id);
    try {
      await attachMic(id);
    } catch (e) {
      setError(e instanceof Error ? `Could not switch microphone: ${e.message}` : "Could not switch microphone.");
    }
  }

  async function acquireScreen(): Promise<boolean> {
    setStartingShare(true);
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true, // Windows Chrome: tick "Share system audio" in the picker
      });
      screenStreamRef.current = screen;
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = screen;
        await screenVideoRef.current.play().catch(() => null);
      }
      screen.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        } else {
          cleanupRecordingMedia();
        }
      });
      setHasSystemAudio(screen.getAudioTracks().length > 0);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.toLowerCase().includes("denied")) {
        setError(`Screen sharing failed: ${msg}`);
      }
      return false;
    } finally {
      setStartingShare(false);
    }
  }

  function mergeAudio(): MediaStream | null {
    const ctx = audioCtxRef.current;
    if (!ctx) return null;
    const dest = ctx.createMediaStreamDestination();
    let connected = false;
    if (micStreamRef.current) {
      try {
        ctx.createMediaStreamSource(micStreamRef.current).connect(dest);
        connected = true;
      } catch { /* ignore */ }
    }
    const screenAudio = screenStreamRef.current?.getAudioTracks() || [];
    if (screenAudio.length > 0) {
      try {
        ctx.createMediaStreamSource(new MediaStream(screenAudio)).connect(dest);
        connected = true;
      } catch { /* ignore */ }
    }
    return connected ? dest.stream : null;
  }

  function pickMime(): string {
    const options = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];
    for (const o of options) {
      if (MediaRecorder.isTypeSupported?.(o)) return o;
    }
    return "";
  }

  const startRecording = useCallback(async () => {
    if (!devicesReady) return;
    setError(null);

    if (mode !== "camera_only" && !screenStreamRef.current) {
      const ok = await acquireScreen();
      if (!ok) return;
    }

    for (let c = 3; c >= 1; c--) {
      setCountdown(c);
      await new Promise((r) => setTimeout(r, 900));
    }
    setCountdown(0);

    const canvas = canvasRef.current;
    if (!canvas) return;
    // 0-fps capture stream: frames are pushed explicitly by the worker ticker,
    // so recording continues at full quality while this tab is backgrounded.
    const stream = canvas.captureStream(0);
    videoTrackRef.current = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
    const audio = mergeAudio();
    audio?.getAudioTracks().forEach((t) => stream.addTrack(t));

    chunksRef.current = [];
    const mime = pickMime();
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime || "video/webm" });
      recordedBlobRef.current = blob;
      setRecordedUrl(URL.createObjectURL(blob));
      setRecording(false);
      cleanupRecordingMedia();
    };
    recorderRef.current = recorder;
    recorder.start(250);
    setRecording(true);
    setRecordingTime(0);
    timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    setPrompterPlaying(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devicesReady, mode, cleanupRecordingMedia]);

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    recorderRef.current?.stop();
  }

  async function continueToEdit() {
    const blob = recordedBlobRef.current;
    if (!blob) return;
    setUploading(true);
    setError(null);
    try {
      const res = await uploadFile<UploadResult>("/api/upload", blob, "take.webm");
      onFinish(res.project_id, mediaUrl(res.url), recordedUrl!);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  // Prompter auto-scroll driven by reading speed (words per minute)
  useEffect(() => {
    if (!prompterPlaying) {
      lastTickRef.current = 0;
      return;
    }
    let raf = 0;
    const fontSize = 30;
    const pxPerWord = fontSize * 0.55 * 6;
    const pxPerSec = (prompterSpeed / 60) * pxPerWord;
    const tick = (ts: number) => {
      const box = prompterBoxRef.current;
      if (box) {
        if (!lastTickRef.current) lastTickRef.current = ts;
        const dt = (ts - lastTickRef.current) / 1000;
        lastTickRef.current = ts;
        box.scrollTop += pxPerSec * dt;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [prompterPlaying, prompterSpeed]);

  const mmss = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const usingScreen = mode !== "camera_only";

  return (
    <div className="max-w-6xl mx-auto">
      <SectionTitle
        step="Step 2 of 4"
        title="Record your video"
        subtitle="Pick your camera and mic, choose a style, and press record. You can always re-take."
      />
      <ErrorBanner message={error} />

      {showPractice && script && (
        <Teleprompter script={script} onClose={() => setShowPractice(false)} />
      )}

      {recordedUrl ? (
        <Panel className="p-6 mt-4">
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <video
              src={recordedUrl}
              controls
              className="w-full max-w-[280px] mx-auto rounded-2xl bg-black aspect-[9/16]"
            />
            <div className="text-center md:text-left">
              <h3 className="text-lg font-bold text-slate-900">Nice take! 🎬</h3>
              <p className="text-slate-500 text-sm mt-1 mb-4">
                Watch it back (sound too). Happy with it? Continue to the polish step — you can
                trim mistakes there.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button size="lg" onClick={continueToEdit} loading={uploading}>
                  Continue →
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => {
                    setRecordedUrl(null);
                    recordedBlobRef.current = null;
                  }}
                >
                  Record again
                </Button>
              </div>
            </div>
          </div>
        </Panel>
      ) : (
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 mt-4">
          {/* ---- Left: viewfinder + controls ---- */}
          <Panel className="p-6">
            {!devicesReady && (
              <div className="mb-5 rounded-xl bg-indigo-50 border border-indigo-100 p-4 text-sm text-indigo-800">
                First time here? Click the button below, allow camera & mic access, then pick
                exactly which camera and microphone to use.
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 mb-5">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  disabled={recording}
                  onClick={() => setMode(m.id)}
                  className={`rounded-xl border-2 p-3 text-center transition ${
                    mode === m.id
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="text-2xl">{m.icon}</div>
                  <div className="text-sm font-semibold text-slate-800 mt-1">{m.label}</div>
                  <div className="text-xs text-slate-400">{m.hint}</div>
                </button>
              ))}
            </div>

            <div className="relative mx-auto w-full max-w-[320px]">
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="w-full rounded-2xl bg-slate-900 aspect-[9/16]"
              />
              {!devicesReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                  <div className="text-4xl mb-3">🎥</div>
                  <p className="text-white/80 text-sm">
                    Turn on your camera & mic to see yourself here.
                  </p>
                </div>
              )}
              {devicesReady && usingScreen && !screenStreamRef.current && !recording && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                  <div className="text-4xl mb-3">🖥️</div>
                  <p className="text-white/80 text-sm">
                    Press Start recording and pick what to share.
                  </p>
                </div>
              )}
              {recording && (
                <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-rose-600 px-3 py-1 text-white text-sm font-bold">
                  <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
                  {mmss(recordingTime)}
                </div>
              )}
              {countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-8xl font-black text-white drop-shadow-lg">
                    {countdown}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col items-center gap-3">
              {!devicesReady ? (
                <Button size="lg" onClick={turnOnDevices}>
                  🎥 Turn on camera & mic
                </Button>
              ) : !recording ? (
                <div className="flex gap-3">
                  <Button size="lg" variant="danger" onClick={startRecording} loading={startingShare}>
                    ● Start recording
                  </Button>
                  <Button variant="ghost" onClick={() => { cleanupRecordingMedia(); releaseDevices(); }}>
                    Turn off devices
                  </Button>
                </div>
              ) : (
                <Button size="lg" variant="secondary" onClick={stopRecording}>
                  ⏹ Stop recording
                </Button>
              )}

              {devicesReady && (
                <div className="w-full max-w-md space-y-2">
                  {/* Camera picker */}
                  {mode !== "screen_only" && camDevices.length > 0 && (
                    <label className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="shrink-0 w-14">Camera</span>
                      <select
                        value={camId}
                        onChange={(e) => switchCamera(e.target.value)}
                        disabled={recording && mode === "camera_only"}
                        className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                      >
                        <option value="">Default camera</option>
                        {camDevices.map((d, i) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {d.label || `Camera ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {/* Mic picker + level */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 shrink-0 w-14">Mic</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${audioLevel * 100}%` }}
                      />
                    </div>
                    {micDevices.length > 0 && (
                      <select
                        value={micId}
                        disabled={recording}
                        onChange={(e) => switchMic(e.target.value)}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 max-w-[150px]"
                      >
                        <option value="">Default microphone</option>
                        {micDevices.map((d, i) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {d.label || `Microphone ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {/* System audio status */}
                  {usingScreen && (
                    <div className="text-xs">
                      {hasSystemAudio === true && (
                        <span className="text-emerald-600 font-medium">
                          🔊 System audio will be recorded
                        </span>
                      )}
                      {hasSystemAudio === false && (
                        <span className="text-amber-600">
                          ⚠️ No system audio shared. When picking your screen, choose “Entire
                          screen” and tick “Also share system audio” (or share a browser tab).
                        </span>
                      )}
                      {hasSystemAudio === null && (
                        <span className="text-slate-400">
                          💡 To record what you hear, tick “Also share system audio” in the
                          screen picker.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Panel>

          {/* ---- Right: teleprompter ---- */}
          <Panel className="p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800">Teleprompter</h3>
              <button
                onClick={() => setShowPractice(true)}
                disabled={!script}
                className="text-xs text-indigo-600 font-semibold hover:underline disabled:opacity-40"
              >
                Full-screen practice
              </button>
            </div>
            {script ? (
              <>
                <div
                  ref={prompterBoxRef}
                  className="flex-1 overflow-y-auto rounded-xl bg-slate-900 p-4 h-[420px] text-white/90 text-[30px] leading-snug font-semibold whitespace-pre-wrap"
                >
                  {prompterText}
                </div>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Button
                      variant={prompterPlaying ? "secondary" : "primary"}
                      size="sm"
                      onClick={() => setPrompterPlaying(!prompterPlaying)}
                    >
                      {prompterPlaying ? "⏸ Pause script" : "▶ Play script"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (prompterBoxRef.current) prompterBoxRef.current.scrollTop = 0;
                      }}
                    >
                      ↺ Back to top
                    </Button>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Reading speed</span>
                      <span className="font-semibold">{prompterSpeed} words/min</span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={200}
                      step={5}
                      value={prompterSpeed}
                      onChange={(e) => setPrompterSpeed(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                <div className="text-3xl mb-2">📝</div>
                <p className="text-sm text-slate-500">
                  Write a script in Step 1 and it will appear here, scrolling while you speak.
                </p>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* Hidden source elements — one ref each */}
      <video ref={screenVideoRef} hidden muted playsInline />
      <video ref={camVideoRef} hidden muted playsInline />
    </div>
  );
}
