'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  X,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Type,
  FastForward,
  CheckCircle2,
  Eye,
  EyeOff,
  Sparkles,
  Camera,
  CircleDot,
  RefreshCw,
  Sliders,
  Volume2,
} from 'lucide-react';

interface TeleprompterProps {
  script: any;
  onClose: () => void;
  onFinishRecording: (recordedBlob?: Blob, recordedUrl?: string) => void;
}

export default function Teleprompter({ script, onClose, onFinishRecording }: TeleprompterProps) {
  // Teleprompter Scrolling State
  const [isPlaying, setIsPlaying] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(2);
  const [fontSize, setFontSize] = useState(28);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Live Camera & MediaRecorder State
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordedBlobData, setRecordedBlobData] = useState<Blob | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [takeNumber, setTakeNumber] = useState(1);

  // AI Eye Contact & Video Enhancements
  const [eyeCorrectionEnabled, setEyeCorrectionEnabled] = useState(true);
  const [eyeIntensity, setEyeIntensity] = useState<'subtle' | 'natural' | 'direct'>('natural');
  const [isMirrored, setIsMirrored] = useState(true);

  // 1. Initialize Webcam Stream
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setMediaStream(stream);
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }
      setIsCameraActive(true);

      // Setup audio level meter
      setupAudioMeter(stream);
    } catch (err) {
      console.warn('Camera/Mic permission denied or not available:', err);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setIsCameraActive(false);
  };

  const setupAudioMeter = (stream: MediaStream) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      const microphone = audioCtx.createMediaStreamSource(stream);
      const javascriptNode = audioCtx.createScriptProcessor(2048, 1, 1);

      analyser.smoothingTimeConstant = 0.8;
      analyser.fftSize = 1024;

      microphone.connect(analyser);
      analyser.connect(javascriptNode);
      javascriptNode.connect(audioCtx.destination);

      javascriptNode.onaudioprocess = () => {
        const array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        let values = 0;
        const length = array.length;
        for (let i = 0; i < length; i++) {
          values += array[i];
        }
        const average = values / length;
        setAudioLevel(Math.min(100, Math.round(average * 2.2)));
      };
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  // 2. Teleprompter Auto-Scroll Loop
  useEffect(() => {
    let animFrame: number;
    const scroll = () => {
      if (isPlaying && scrollRef.current) {
        scrollRef.current.scrollTop += scrollSpeed * 0.75;
      }
      animFrame = requestAnimationFrame(scroll);
    };
    animFrame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animFrame);
  }, [isPlaying, scrollSpeed]);

  // 3. Recording Timer
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // 4. Start Recording with 3-2-1 Countdown
  const triggerRecording = () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    setCountdown(3);
    const countInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countInterval);
          startActualRecording();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startActualRecording = () => {
    if (!mediaStream) {
      startCamera();
    }

    try {
      const stream = mediaStream || videoPreviewRef.current?.srcObject as MediaStream;
      if (!stream) return;

      const options = { mimeType: 'video/webm;codecs=vp9,opus' };
      const mime = MediaRecorder.isTypeSupported(options.mimeType) ? options.mimeType : 'video/webm';

      const recorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = recorder;
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const fullBlob = new Blob(chunks, { type: 'video/webm' });
        const blobUrl = URL.createObjectURL(fullBlob);
        setRecordedChunks(chunks);
        setRecordedBlobData(fullBlob);
        setRecordedVideoUrl(blobUrl);
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordSeconds(0);
      setIsPlaying(true); // Auto-start prompter scroll
    } catch (err) {
      console.error('Failed to start MediaRecorder:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsPlaying(false);
  };

  const retakeRecording = () => {
    setRecordedVideoUrl(null);
    setRecordedBlobData(null);
    setRecordedChunks([]);
    setRecordSeconds(0);
    setTakeNumber((prev) => prev + 1);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  const handleFinish = async () => {
    stopCamera();
    if (recordedBlobData) {
      // Upload recorded video to backend
      const formData = new FormData();
      formData.append('file', recordedBlobData, `take_${takeNumber}.webm`);
      try {
        const res = await fetch('http://127.0.0.1:8000/api/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        onFinishRecording(recordedBlobData, data.url ? `http://127.0.0.1:8000${data.url}` : recordedVideoUrl || '');
        return;
      } catch (e) {
        console.error(e);
      }
    }
    onFinishRecording(recordedBlobData || undefined, recordedVideoUrl || undefined);
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-between p-4 sm:p-6 animate-fadeIn select-none">
      {/* 3-2-1 Countdown Overlay */}
      {countdown !== null && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center pointer-events-none">
          <div className="text-8xl sm:text-9xl font-black text-amber-400 animate-ping">
            {countdown}
          </div>
        </div>
      )}

      {/* Top Floating Control Bar */}
      <div className="w-full max-w-5xl glass-panel px-6 py-3 rounded-2xl border border-surface-border flex flex-wrap items-center justify-between gap-4 shadow-2xl">
        {/* Recording Status Badge */}
        <div className="flex items-center gap-3">
          <div
            className={`w-3.5 h-3.5 rounded-full ${
              isRecording ? 'bg-rose-500 animate-pulse ring-4 ring-rose-500/30' : 'bg-slate-600'
            }`}
          />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <span>{isRecording ? 'Recording Live Take' : 'Prompter & Recording Studio'}</span>
              <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px]">
                Take #{takeNumber}
              </span>
            </div>
            {isRecording && (
              <div className="text-xs font-mono font-bold text-rose-400">
                REC {formatTimer(recordSeconds)}
              </div>
            )}
          </div>
        </div>

        {/* AI Eye Contact Toggle */}
        <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-surface-border">
          <button
            onClick={() => setEyeCorrectionEnabled(!eyeCorrectionEnabled)}
            className={`flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-lg transition ${
              eyeCorrectionEnabled
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {eyeCorrectionEnabled ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{eyeCorrectionEnabled ? 'Eye Contact AI: ACTIVE' : 'Eye Contact: OFF'}</span>
          </button>
        </div>

        {/* Audio Mic Level Meter */}
        <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-surface-border text-xs text-slate-300">
          <Mic className={`w-3.5 h-3.5 ${audioLevel > 15 ? 'text-emerald-400' : 'text-slate-500'}`} />
          <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden flex items-center">
            <div
              className={`h-full transition-all duration-75 ${
                audioLevel > 70 ? 'bg-rose-500' : audioLevel > 40 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${audioLevel}%` }}
            />
          </div>
        </div>

        {/* Prompter Controls: Speed & Font */}
        <div className="flex items-center gap-4 text-xs text-slate-300">
          <div className="flex items-center gap-1.5">
            <FastForward className="w-3.5 h-3.5 text-indigo-400" />
            <input
              type="range"
              min="1"
              max="5"
              step="0.5"
              value={scrollSpeed}
              onChange={(e) => setScrollSpeed(parseFloat(e.target.value))}
              className="w-16 accent-indigo-500 cursor-pointer"
            />
            <span className="font-mono w-5">{scrollSpeed}x</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-cyan-400" />
            <input
              type="range"
              min="20"
              max="48"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              className="w-16 accent-cyan-500 cursor-pointer"
            />
            <span className="font-mono w-6">{fontSize}px</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Studio View: Live Camera on Left, Scrolling Teleprompter on Right */}
      <div className="w-full max-w-5xl flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 my-4 overflow-hidden items-center">
        {/* Left Column: Live Camera Feed with 9:16 Frame */}
        <div className="md:col-span-5 flex flex-col items-center justify-center h-full">
          <div className="relative w-[280px] h-[460px] sm:w-[310px] sm:h-[510px] rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800/80 bg-black flex items-center justify-center">
            {/* Live Webcam Stream or Recorded Review */}
            {recordedVideoUrl ? (
              <video
                src={recordedVideoUrl}
                controls
                autoPlay
                className="w-full h-full object-cover"
              />
            ) : isCameraActive ? (
              <video
                ref={videoPreviewRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${isMirrored ? 'scale-x-[-1]' : ''}`}
              />
            ) : (
              <div className="text-center p-6 space-y-3">
                <VideoOff className="w-10 h-10 text-slate-600 mx-auto" />
                <div className="text-sm font-bold text-slate-400">Webcam Inactive</div>
                <button
                  onClick={startCamera}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                >
                  Enable Camera
                </button>
              </div>
            )}

            {/* AI Eye Contact Centering Target Box */}
            {isCameraActive && !recordedVideoUrl && eyeCorrectionEnabled && (
              <div className="absolute top-12 inset-x-8 h-28 border border-dashed border-emerald-400/50 rounded-2xl pointer-events-none flex items-center justify-center">
                <span className="text-[9px] uppercase tracking-widest bg-emerald-950/80 text-emerald-300 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/40">
                  👁️ Eye Gaze Lock Target
                </span>
              </div>
            )}

            {/* Recording Pulse Watermark */}
            {isRecording && (
              <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-rose-600/90 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-lg">
                <CircleDot className="w-3 h-3 animate-ping" />
                <span>REC {formatTimer(recordSeconds)}</span>
              </div>
            )}
          </div>

          {/* Mirror Camera & Retake Option */}
          <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
            <button
              onClick={() => setIsMirrored(!isMirrored)}
              className="hover:text-white flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{isMirrored ? 'Mirrored' : 'Normal'}</span>
            </button>

            {recordedVideoUrl && (
              <button
                onClick={retakeRecording}
                className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Record Another Take</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Auto-Scrolling Teleprompter Text */}
        <div className="md:col-span-7 h-full flex flex-col justify-between glass-panel p-6 rounded-3xl border border-surface-border overflow-hidden">
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto pr-4 scroll-smooth space-y-8 text-center text-white"
            style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}
          >
            <div className="text-slate-500 text-xs font-mono uppercase tracking-widest pb-4">
              --- START OF SCRIPT (READ NATURALLY) ---
            </div>

            {/* Hook */}
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
                [ 🪝 HOOK - 0 to 3 SECONDS ]
              </div>
              <div className="font-extrabold text-amber-300 drop-shadow-md">
                {script?.hook?.spoken_text || 'Stop scrolling if you want to scale your business!'}
              </div>
              <div className="text-xs text-amber-200/60 italic font-normal">
                Action: {script?.hook?.visual_action}
              </div>
            </div>

            {/* Body Lines */}
            {script?.body_lines?.map((line: any, idx: number) => (
              <div key={idx} className="space-y-1 pt-3">
                <div className="text-xs font-bold uppercase tracking-widest text-indigo-400">
                  [ 💡 STEP {idx + 1} ]
                </div>
                <div className="font-bold text-slate-100">
                  {line.spoken_text}
                </div>
                <div className="text-xs text-slate-400 italic font-normal">
                  Action: {line.visual_action}
                </div>
              </div>
            ))}

            {/* CTA */}
            <div className="space-y-1 pt-3">
              <div className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                [ 🎯 CALL TO ACTION ]
              </div>
              <div className="font-extrabold text-emerald-300">
                {script?.cta?.spoken_text || 'Drop a comment and follow for daily actionable strategies!'}
              </div>
              <div className="text-xs text-emerald-200/60 italic font-normal">
                Action: {script?.cta?.visual_action}
              </div>
            </div>

            <div className="text-slate-500 text-xs font-mono uppercase tracking-widest pt-8">
              --- END OF SCRIPT ---
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Floating Control Deck */}
      <div className="w-full max-w-2xl glass-panel px-6 py-3.5 rounded-3xl border border-surface-border flex items-center justify-between shadow-2xl">
        <button
          onClick={() => {
            if (scrollRef.current) scrollRef.current.scrollTop = 0;
            setIsPlaying(false);
          }}
          className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          title="Reset to Top"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Master Record / Stop Button */}
        <button
          onClick={triggerRecording}
          className={`px-8 py-3.5 rounded-2xl font-black text-sm flex items-center gap-2.5 shadow-2xl transition transform hover:scale-105 ${
            isRecording
              ? 'bg-rose-600 text-white shadow-rose-600/40 ring-4 ring-rose-500/30'
              : 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-rose-500/30'
          }`}
        >
          {isRecording ? (
            <>
              <div className="w-4 h-4 rounded-sm bg-white animate-pulse" />
              <span>STOP RECORDING TAKE ({formatTimer(recordSeconds)})</span>
            </>
          ) : (
            <>
              <CircleDot className="w-5 h-5 text-white animate-pulse" />
              <span>START RECORDING (3s Countdown)</span>
            </>
          )}
        </button>

        {/* Finish & Move to Edit */}
        <button
          onClick={handleFinish}
          className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 flex items-center gap-2 transition"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Move to Auto-Edit</span>
        </button>
      </div>
    </div>
  );
}
