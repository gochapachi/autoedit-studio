'use client';

import React, { useRef, useEffect } from 'react';
import { Layers, Film, Music, Type, Sparkles, Flame } from 'lucide-react';

interface ProTimelineProps {
  duration?: number;
  currentTime: number;
  onSeek: (time: number) => void;
  subtitles?: any[];
  silences?: any[];
}

export default function ProTimeline({
  duration = 15,
  currentTime,
  onSeek,
  subtitles = [],
  silences = [],
}: ProTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * duration);
  };

  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="glass-panel p-4 rounded-2xl border border-surface-border space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Pro Multi-Track Timeline & Retention Heatmap
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
          <span>{currentTime.toFixed(2)}s / {duration.toFixed(2)}s</span>
        </div>
      </div>

      {/* Interactive Timeline Container */}
      <div
        ref={containerRef}
        onClick={handleTimelineClick}
        className="relative h-40 bg-slate-950/80 rounded-xl border border-surface-border overflow-hidden cursor-pointer select-none"
      >
        {/* Playhead Red Vertical Line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-30 pointer-events-none transition-all duration-75"
          style={{ left: `${playheadPercent}%` }}
        >
          <div className="w-3 h-3 bg-rose-500 rounded-full -ml-[5px] -mt-1 shadow-md shadow-rose-500/50" />
        </div>

        {/* Track 1: Retention Heatmap (Green = High Retention, Orange = Risk) */}
        <div className="h-6 border-b border-surface-border/50 flex items-center px-2 bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-amber-500/20 relative">
          <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1">
            <Flame className="w-3 h-3 text-emerald-400" /> 92% Viral Retention Curve
          </span>
        </div>

        {/* Track 2: Video Cuts & Punch-ins */}
        <div className="h-10 border-b border-surface-border/50 flex items-center px-2 relative bg-indigo-950/20">
          <span className="text-[10px] font-semibold text-indigo-300 flex items-center gap-1.5 shrink-0 w-16">
            <Film className="w-3 h-3" /> Video
          </span>
          <div className="flex-1 flex gap-1 h-6">
            <div className="flex-1 rounded bg-indigo-600/30 border border-indigo-500/40 text-[9px] text-indigo-200 flex items-center justify-center font-mono">
              Take 2 (⭐ Best) [9:16 Auto-Reframe]
            </div>
          </div>
        </div>

        {/* Track 3: Subtitles / Karaoke Words */}
        <div className="h-10 border-b border-surface-border/50 flex items-center px-2 relative bg-cyan-950/20">
          <span className="text-[10px] font-semibold text-cyan-300 flex items-center gap-1.5 shrink-0 w-16">
            <Type className="w-3 h-3" /> Captions
          </span>
          <div className="flex-1 flex gap-1 h-6">
            {subtitles && subtitles.slice(0, 8).map((w: any, idx: number) => {
              const leftPct = duration > 0 ? (w.start / duration) * 100 : 0;
              const widthPct = duration > 0 ? ((w.end - w.start) / duration) * 100 : 5;
              return (
                <div
                  key={idx}
                  className="rounded bg-cyan-500/30 border border-cyan-500/40 text-[9px] text-cyan-200 flex items-center justify-center font-bold truncate px-1"
                  style={{ width: `${Math.max(widthPct, 4)}%` }}
                >
                  {w.word}
                </div>
              );
            })}
          </div>
        </div>

        {/* Track 4: Audio / BGM & SFX Waveform */}
        <div className="h-14 flex items-center px-2 relative bg-emerald-950/20">
          <span className="text-[10px] font-semibold text-emerald-300 flex items-center gap-1.5 shrink-0 w-16">
            <Music className="w-3 h-3" /> BGM
          </span>
          <div className="flex-1 flex items-center justify-center gap-0.5 h-8">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-emerald-500/40 rounded-full"
                style={{ height: `${Math.sin(i * 0.4) * 14 + 16}px` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
