'use client';

import React from 'react';
import { Sparkles, TrendingUp, AlertCircle, CheckCircle2, Zap } from 'lucide-react';

interface AICopilotProps {
  viralScore?: number;
  onApplyTip?: (tipType: string) => void;
}

export default function AICopilot({ viralScore = 92, onApplyTip }: AICopilotProps) {
  return (
    <div className="glass-panel p-4 rounded-2xl border border-surface-border space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-white uppercase tracking-wider">AI Retention Copilot</span>
        </div>

        {/* Viral Retention Score Gauge */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Viral Potential:</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-xs flex items-center gap-1 border border-emerald-500/30">
            <Zap className="w-3 h-3 fill-current" /> {viralScore}/100
          </span>
        </div>
      </div>

      {/* Actionable Suggestions */}
      <div className="space-y-2 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-900/70 border border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Pacing is fast & tight. 3.8s silences removed automatically.</span>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900/70 border border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Alex Hormozi kinetic bouncing subtitles active.</span>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900/70 border border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span>BGM beat sync & vocal sidechain ducking (-18dB) engaged.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
