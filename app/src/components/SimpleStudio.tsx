'use client';

import React, { useState } from 'react';
import { Sparkles, Trash2, CheckCircle2, Scissors, Volume2, ShieldCheck, Star, Layers, RefreshCw } from 'lucide-react';

interface SimpleStudioProps {
  transcriptData: any;
  alignedLines: any[];
  onSeek: (time: number) => void;
  onCleanVAD: () => void;
  onCleanFillers: () => void;
  silenceCutSec: number;
  fillerCount: number;
}

export default function SimpleStudio({
  transcriptData,
  alignedLines = [],
  onSeek,
  onCleanVAD,
  onCleanFillers,
  silenceCutSec = 0,
  fillerCount = 0,
}: SimpleStudioProps) {
  const [selectedWords, setSelectedWords] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<'script_match' | 'full_doc'>('script_match');

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Action Header & Quick 1-Click Cleaners */}
      <div className="glass-panel p-4 rounded-2xl border border-surface-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('script_match')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              viewMode === 'script_match'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-surface text-slate-400 hover:text-white'
            }`}
          >
            📋 Script Take Matcher
          </button>
          <button
            onClick={() => setViewMode('full_doc')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              viewMode === 'full_doc'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-surface text-slate-400 hover:text-white'
            }`}
          >
            📄 Interactive Transcript
          </button>
        </div>

        {/* 1-Click Smart Cleaners */}
        <div className="flex items-center gap-2">
          <button
            onClick={onCleanVAD}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-surface-border text-xs font-semibold text-cyan-300 hover:text-white transition flex items-center gap-1.5"
            title="Auto-cut silences > 0.35s"
          >
            <Scissors className="w-3.5 h-3.5 text-cyan-400" />
            <span>{silenceCutSec > 0 ? `Cut ${silenceCutSec}s Silences` : 'Clean Silences'}</span>
          </button>

          <button
            onClick={onCleanFillers}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-surface-border text-xs font-semibold text-rose-300 hover:text-white transition flex items-center gap-1.5"
            title="Remove ums, ahs, and stumbles"
          >
            <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            <span>{fillerCount > 0 ? `Purged ${fillerCount} Fillers` : 'Purge Ums/Ahs'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {viewMode === 'script_match' ? (
          /* Script Take Matcher Checklist */
          <div className="space-y-3">
            {alignedLines && alignedLines.length > 0 ? (
              alignedLines.map((line: any, idx: number) => {
                const bestTake = line.takes?.find((t: any) => t.is_best) || line.takes?.[0];
                return (
                  <div
                    key={idx}
                    onClick={() => bestTake && onSeek(bestTake.start)}
                    className="glass-panel p-4 rounded-2xl border border-surface-border hover:border-indigo-500/40 cursor-pointer transition space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          {line.type === 'hook' ? '🪝 Hook' : line.type === 'cta' ? '🎯 CTA' : `💡 Step ${idx}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-extrabold text-[10px] flex items-center gap-1">
                          <Star className="w-3 h-3 fill-current" /> Take {bestTake?.take_number || 1} (Best)
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {bestTake?.start.toFixed(1)}s - {bestTake?.end.toFixed(1)}s
                        </span>
                      </div>
                    </div>

                    <p className="text-sm font-semibold text-white group-hover:text-indigo-200 transition">
                      "{line.target_text}"
                    </p>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <span className="italic">{line.visual_action}</span>
                      <span className="text-sm">{line.emoji}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 glass-panel rounded-2xl border border-surface-border space-y-2">
                <Layers className="w-8 h-8 text-slate-500 mx-auto" />
                <div className="text-sm font-bold text-slate-300">No Script Attached</div>
                <p className="text-xs text-slate-500">Generate a script in Step 1 to auto-align takes!</p>
              </div>
            )}
          </div>
        ) : (
          /* Full Document Interactive Transcript */
          <div className="glass-panel p-5 rounded-2xl border border-surface-border space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Interactive Transcript (Select & Backspace to Cut)</span>
              <span className="text-[10px] font-normal text-slate-500">Click word to seek</span>
            </div>

            <div className="flex flex-wrap gap-1.5 leading-relaxed">
              {transcriptData?.words?.map((w: any, idx: number) => {
                const isSelected = selectedWords.includes(idx);
                return (
                  <span
                    key={idx}
                    onClick={() => onSeek(w.start)}
                    className={`px-1.5 py-0.5 rounded text-sm cursor-pointer transition font-medium ${
                      isSelected
                        ? 'bg-rose-500/40 text-rose-200 line-through'
                        : 'text-slate-200 hover:bg-indigo-600/30 hover:text-white'
                    }`}
                  >
                    {w.word}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
