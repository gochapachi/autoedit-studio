'use client';

import React, { useState } from 'react';
import { Sparkles, Play, Clock, ArrowRight, RefreshCw, CheckCircle2, Edit3, Volume2 } from 'lucide-react';

interface ScriptGenProps {
  topic: string;
  businessProfile: any;
  onScriptReady: (script: any) => void;
  onOpenPrompter: () => void;
}

export default function ScriptGen({ topic, businessProfile, onScriptReady, onOpenPrompter }: ScriptGenProps) {
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState(45);
  const [scriptData, setScriptData] = useState<any>(null);

  const generateScript = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/gemini/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic || '3 AI Tools That Automate Video Editing',
          business_profile: businessProfile,
          target_duration_sec: duration,
        }),
      });
      const data = await res.json();
      setScriptData(data);
      onScriptReady(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Control Bar */}
      <div className="glass-panel p-5 rounded-3xl border border-surface-border flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Target Topic</div>
          <div className="text-base font-extrabold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            {topic || '3 AI Tools That Automate Video Editing'}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-surface-border text-xs text-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Target:</span>
            <button
              onClick={() => setDuration(30)}
              className={`px-2 py-0.5 rounded font-bold transition ${
                duration === 30 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              30s
            </button>
            <button
              onClick={() => setDuration(45)}
              className={`px-2 py-0.5 rounded font-bold transition ${
                duration === 45 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              45s
            </button>
            <button
              onClick={() => setDuration(60)}
              className={`px-2 py-0.5 rounded font-bold transition ${
                duration === 60 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              60s
            </button>
          </div>

          <button
            onClick={generateScript}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Writing Script...' : scriptData ? 'Regenerate' : 'Generate Viral Script'}</span>
          </button>
        </div>
      </div>

      {/* Script Display */}
      {scriptData && (
        <div className="space-y-4 animate-fadeIn">
          {/* Hook Block */}
          <div className="glass-panel p-5 rounded-2xl border border-amber-500/30 bg-amber-950/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-extrabold text-[10px] tracking-wider uppercase flex items-center gap-1">
                🪝 0-3s Scroll-Stopping Hook
              </span>
              <span className="text-xs font-mono text-amber-400/80">SFX: {scriptData.hook?.sfx || 'Riser'}</span>
            </div>
            <p className="text-base font-bold text-white leading-relaxed">
              "{scriptData.hook?.spoken_text}"
            </p>
            <div className="flex items-center gap-2 text-xs text-amber-200/70 pt-1">
              <span className="font-semibold">Visual Action:</span>
              <span className="italic">{scriptData.hook?.visual_action}</span>
            </div>
          </div>

          {/* Body Lines */}
          <div className="space-y-3">
            {scriptData.body_lines?.map((line: any, idx: number) => (
              <div key={idx} className="glass-panel p-4 rounded-2xl border border-surface-border space-y-2 hover:border-indigo-500/30 transition">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-[10px] uppercase">
                    Step {idx + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{line.emoji_highlight || '💡'}</span>
                    <span className="text-[11px] font-mono text-slate-400">SFX: {line.sfx || 'pop'}</span>
                  </div>
                </div>
                <p className="text-sm font-semibold text-slate-100">
                  "{line.spoken_text}"
                </p>
                <div className="text-xs text-slate-400 italic">
                  Action: {line.visual_action}
                </div>
              </div>
            ))}
          </div>

          {/* CTA Block */}
          <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-[10px] tracking-wider uppercase">
                🎯 High-Converting CTA
              </span>
              <span className="text-xs font-mono text-emerald-400/80">SFX: {scriptData.cta?.sfx || 'Ding'}</span>
            </div>
            <p className="text-sm font-bold text-white">
              "{scriptData.cta?.spoken_text}"
            </p>
            <div className="text-xs text-emerald-200/70 italic">
              Action: {scriptData.cta?.visual_action}
            </div>
          </div>

          {/* Launch Prompter Button */}
          <div className="flex items-center justify-between pt-4">
            <div className="text-xs text-slate-400">
              Ready to record? Launch the desktop camera prompter overlay.
            </div>
            <button
              onClick={onOpenPrompter}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-bold shadow-xl shadow-emerald-500/25 flex items-center gap-2.5 transition transform hover:scale-[1.02]"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Open Desktop Teleprompter & Record</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
