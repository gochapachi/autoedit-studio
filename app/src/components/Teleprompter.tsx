"use client";

import { useEffect, useRef, useState } from "react";
import { VideoScript } from "@/lib/api";
import { Button } from "@/components/ui";

/**
 * Full-screen teleprompter for practicing your script before recording.
 * Shows your webcam as a small confidence monitor and auto-scrolls the script
 * at a chosen reading speed. Purely a preview — nothing is recorded here.
 */
export default function Teleprompter({
  script,
  onClose,
}: {
  script: VideoScript;
  onClose: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(140);
  const [mirror, setMirror] = useState(true);
  const [camError, setCamError] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastTickRef = useRef(0);

  const lines = [
    script.hook?.spoken_text,
    ...script.body_lines.map((l) => l.spoken_text),
    script.cta?.spoken_text,
  ].filter(Boolean);

  const text = lines.join("\n\n");

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => null);
        }
      })
      .catch(() => setCamError(true));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Keyboard: Space toggles scroll, Esc closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!playing) {
      lastTickRef.current = 0;
      return;
    }
    let raf = 0;
    const fontSize = 44;
    const pxPerWord = fontSize * 0.55 * 6;
    const pxPerSec = (speed / 60) * pxPerWord;
    const tick = (ts: number) => {
      const box = boxRef.current;
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
  }, [playing, speed]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
      {/* Script */}
      <div
        ref={boxRef}
        className="flex-1 overflow-y-auto px-6 md:px-24 py-16 text-center text-white text-[44px] leading-tight font-bold whitespace-pre-wrap"
      >
        {text}
      </div>

      {/* Webcam confidence monitor */}
      {!camError && (
        <video
          ref={videoRef}
          muted
          playsInline
          className={`fixed bottom-32 right-8 w-44 rounded-2xl border-2 border-white/20 shadow-2xl ${
            mirror ? "scale-x-[-1]" : ""
          }`}
        />
      )}

      {/* Control deck */}
      <div className="bg-black/60 backdrop-blur border-t border-white/10 px-6 py-4 flex flex-wrap items-center justify-center gap-4">
        <Button
          variant={playing ? "secondary" : "primary"}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? "⏸ Pause (Space)" : "▶ Start scrolling (Space)"}
        </Button>
        <Button
          variant="ghost"
          className="text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => {
            if (boxRef.current) boxRef.current.scrollTop = 0;
          }}
        >
          ↺ Top
        </Button>
        <div className="flex items-center gap-3 min-w-[240px]">
          <span className="text-white/60 text-xs">Speed</span>
          <input
            type="range"
            min={100}
            max={200}
            step={5}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="flex-1 accent-indigo-400"
          />
          <span className="text-white/80 text-xs font-semibold w-20">{speed} wpm</span>
        </div>
        <button
          onClick={() => setMirror(!mirror)}
          className="text-white/50 text-xs hover:text-white"
        >
          {mirror ? "Mirror cam" : "Normal cam"}
        </button>
        <Button variant="secondary" onClick={onClose}>
          ✕ Done practicing
        </Button>
      </div>
    </div>
  );
}
