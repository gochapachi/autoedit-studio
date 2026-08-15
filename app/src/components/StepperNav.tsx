'use client';

import React from 'react';
import { Sparkles, Video, FileText, CheckCircle2, ArrowRight, FastForward, Cpu } from 'lucide-react';

interface StepperNavProps {
  currentStage: number;
  setStage: (stage: number) => void;
  gpuStatus: { gpu_available: boolean; gpu_name: string; encoder: string };
}

export const STAGES = [
  { id: 1, name: 'Idea & Script', icon: Sparkles, desc: 'Brand Brain & Gemini SEO' },
  { id: 2, name: 'Prompter & Record', icon: FileText, desc: 'Floating Desktop Prompter' },
  { id: 3, name: 'Auto-Edit Studio', icon: Video, desc: 'AI Cuts, Captions & BGM' },
  { id: 4, name: 'Launch & Export', icon: CheckCircle2, desc: 'GPU NVENC & Social Copy' },
];

export default function StepperNav({ currentStage, setStage, gpuStatus }: StepperNavProps) {
  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-surface-border px-6 py-3.5 flex items-center justify-between">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setStage(1)}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
          <Sparkles className="w-5 h-5 text-white animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400">
              AutoEdit Studio
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Native GPU
            </span>
          </div>
          <p className="text-xs text-slate-400">Autonomous Video Editing Engine</p>
        </div>
      </div>

      {/* 4-Stage Stepper Navigation */}
      <div className="hidden md:flex items-center gap-1.5 bg-surface/80 p-1.5 rounded-2xl border border-surface-border">
        {STAGES.map((stage) => {
          const Icon = stage.icon;
          const isActive = currentStage === stage.id;
          const isCompleted = currentStage > stage.id;

          return (
            <button
              key={stage.id}
              onClick={() => setStage(stage.id)}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                  : isCompleted
                  ? 'text-indigo-300 hover:text-white hover:bg-surface-hover'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface-hover'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : isCompleted
                    ? 'bg-indigo-500/20 text-indigo-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {stage.id}
              </div>
              <div className="text-left">
                <div>{stage.name}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Hardware Status & Quick Skip */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-surface-border text-xs">
          <Cpu className={`w-3.5 h-3.5 ${gpuStatus.gpu_available ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="text-slate-300 font-mono">
            {gpuStatus.gpu_available ? gpuStatus.gpu_name : 'CPU / DirectML'}
          </span>
          <span className="px-1.5 py-0.2 text-[9px] rounded bg-emerald-500/20 text-emerald-400 font-bold">
            {gpuStatus.encoder}
          </span>
        </div>

        {currentStage === 1 && (
          <button
            onClick={() => setStage(3)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white text-xs font-medium transition border border-indigo-500/20"
          >
            <FastForward className="w-3.5 h-3.5 text-indigo-400" />
            <span>Skip to Quick Edit</span>
          </button>
        )}
      </div>
    </header>
  );
}
