"use client";

import { History } from "lucide-react";

const STEPS = [
  { n: 1, label: "Plan", hint: "Topic & script" },
  { n: 2, label: "Record", hint: "Camera & screen" },
  { n: 3, label: "Polish", hint: "Trim & captions" },
  { n: 4, label: "Create", hint: "Export video" },
];

interface Props {
  step: 1 | 2 | 3 | 4;
  setStep: (s: 1 | 2 | 3 | 4) => void;
  hasScript: boolean;
  hasVideo: boolean;
  engineOnline: boolean | null;
  engineNote: string;
  onOpenHistory: () => void;
}

export default function StepperNav({
  step,
  setStep,
  hasScript,
  hasVideo,
  engineOnline,
  engineNote,
  onOpenHistory,
}: Props) {
  // Simple gating: you can only jump to a step whose prerequisites exist.
  function canGo(n: number): boolean {
    if (n === 1) return true;
    if (n === 2) return hasScript;
    if (n === 3 || n === 4) return hasVideo;
    return false;
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black">
            A
          </div>
          <div className="leading-tight">
            <div className="font-bold text-slate-900">AutoEdit Studio</div>
            <div className="text-[11px] text-slate-400">
              {engineOnline === null
                ? "Starting…"
                : engineOnline
                ? engineNote || "Ready"
                : "Engine offline"}
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1 sm:gap-2 flex-1 justify-center">
          {STEPS.map((s, i) => {
            const active = step === s.n;
            const done = step > s.n;
            const enabled = canGo(s.n);
            return (
              <div key={s.n} className="flex items-center">
                <button
                  disabled={!enabled}
                  onClick={() => enabled && setStep(s.n as 1 | 2 | 3 | 4)}
                  className={`flex items-center gap-2 rounded-xl px-2.5 sm:px-3.5 py-2 transition ${
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : enabled
                      ? "text-slate-500 hover:bg-slate-100"
                      : "text-slate-300 cursor-not-allowed"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      done
                        ? "bg-emerald-500 text-white"
                        : active
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {done ? "✓" : s.n}
                  </span>
                  <span className="hidden md:block text-sm font-semibold">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <span className="hidden sm:block h-px w-4 bg-slate-200 mx-0.5" />
                )}
              </div>
            );
          })}
        </nav>

        <button
          onClick={onOpenHistory}
          title="Saved scripts & topics"
          className="flex items-center gap-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl px-3 py-2 text-sm"
        >
          <History size={16} />
          <span className="hidden sm:inline">Saved</span>
        </button>
      </div>
    </header>
  );
}
