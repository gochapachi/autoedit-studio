'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, X, Video, Type, FastForward, CheckCircle2, Eye, EyeOff, Sparkles, Sliders } from 'lucide-react';

interface TeleprompterProps {
  script: any;
  onClose: () => void;
  onFinishRecording: () => void;
}

export default function Teleprompter({ script, onClose, onFinishRecording }: TeleprompterProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(2);
  const [fontSize, setFontSize] = useState(28);
  const [eyeCorrectionEnabled, setEyeCorrectionEnabled] = useState(true);
  const [eyeIntensity, setEyeIntensity] = useState<'subtle' | 'natural' | 'direct'>('natural');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll animation loop
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

  // Spacebar toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const resetScroll = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
      setIsPlaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-between p-4 sm:p-6 animate-fadeIn select-none">
      {/* Top Floating Control Bar */}
      <div className="w-full max-w-4xl glass-panel px-6 py-3 rounded-2xl border border-surface-border flex flex-wrap items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Prompter & Eye Contact Studio
          </span>
        </div>

        {/* AI Eye Contact Correction Control */}
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
            <span>{eyeCorrectionEnabled ? 'AI Eye Contact: ON' : 'AI Eye Contact: OFF'}</span>
          </button>

          {eyeCorrectionEnabled && (
            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 pl-1 border-l border-surface-border">
              <button
                onClick={() => setEyeIntensity('subtle')}
                className={`px-1.5 py-0.5 rounded ${
                  eyeIntensity === 'subtle' ? 'bg-indigo-600 text-white font-bold' : 'hover:text-white'
                }`}
              >
                Subtle
              </button>
              <button
                onClick={() => setEyeIntensity('natural')}
                className={`px-1.5 py-0.5 rounded ${
                  eyeIntensity === 'natural' ? 'bg-indigo-600 text-white font-bold' : 'hover:text-white'
                }`}
              >
                Natural (85%)
              </button>
              <button
                onClick={() => setEyeIntensity('direct')}
                className={`px-1.5 py-0.5 rounded ${
                  eyeIntensity === 'direct' ? 'bg-indigo-600 text-white font-bold' : 'hover:text-white'
                }`}
              >
                Locked
              </button>
            </div>
          )}
        </div>

        {/* Speed & Font Adjusters */}
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

      {/* Prompter Text Scroll Area */}
      <div
        ref={scrollRef}
        className="w-full max-w-2xl flex-1 overflow-y-auto my-6 px-8 py-12 scroll-smooth space-y-10 text-center text-white select-none"
        style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}
      >
        <div className="text-slate-500 text-xs font-mono uppercase tracking-widest pb-6">
          --- START OF SCRIPT (READ NATURALLY - AI WILL CORRECT GAZE) ---
        </div>

        {/* Hook */}
        <div className="space-y-2">
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
          <div key={idx} className="space-y-2 pt-4">
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
        <div className="space-y-2 pt-4">
          <div className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            [ 🎯 CALL TO ACTION ]
          </div>
          <div className="font-extrabold text-emerald-300">
            {script?.cta?.spoken_text || 'Drop a comment and follow for more!'}
          </div>
          <div className="text-xs text-emerald-200/60 italic font-normal">
            Action: {script?.cta?.visual_action}
          </div>
        </div>

        <div className="text-slate-500 text-xs font-mono uppercase tracking-widest pt-12">
          --- END OF SCRIPT ---
        </div>
      </div>

      {/* Bottom Floating Control Deck */}
      <div className="w-full max-w-xl glass-panel px-6 py-3.5 rounded-3xl border border-surface-border flex items-center justify-between shadow-2xl">
        <button
          onClick={resetScroll}
          className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          title="Reset to Top"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Big Play / Pause Button */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`px-8 py-3 rounded-2xl font-extrabold text-sm flex items-center gap-2 shadow-xl transition transform hover:scale-105 ${
            isPlaying
              ? 'bg-amber-500 text-slate-950 shadow-amber-500/30'
              : 'bg-indigo-600 text-white shadow-indigo-600/30'
          }`}
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
          <span>{isPlaying ? 'PAUSE (Space)' : 'START AUTO-SCROLL (Space)'}</span>
        </button>

        {/* Finish & Move to Edit */}
        <button
          onClick={onFinishRecording}
          className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 flex items-center gap-2 transition"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Done Recording</span>
        </button>
      </div>
    </div>
  );
}
