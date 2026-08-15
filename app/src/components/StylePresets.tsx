'use client';

import React from 'react';
import { Flame, Sparkles, Gem, Terminal, Zap } from 'lucide-react';

interface StylePresetsProps {
  selectedStyle: string;
  onSelectStyle: (style: string) => void;
  selectedLUT: string;
  onSelectLUT: (lut: string) => void;
}

export const STYLES = [
  {
    id: 'hormozi',
    name: 'Alex Hormozi',
    desc: 'Bold yellow active bounce, heavy stroke & drop shadow',
    icon: Flame,
    color: 'from-amber-500 to-yellow-600',
    badge: 'Trending #1',
  },
  {
    id: 'mrbeast',
    name: 'MrBeast Viral',
    desc: 'High contrast green color blocks & explosive scale pop',
    icon: Zap,
    color: 'from-emerald-500 to-green-600',
    badge: 'Max Retention',
  },
  {
    id: 'minimalist',
    name: 'Luxury Minimalist',
    desc: 'Clean typography, subtle underline & calm pacing',
    icon: Gem,
    color: 'from-slate-400 to-slate-600',
    badge: 'Aesthetic',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    desc: 'Cyan/Magenta glowing font with futuristic energy',
    icon: Terminal,
    color: 'from-cyan-500 to-fuchsia-600',
    badge: 'Tech & Gaming',
  },
];

export const COLOR_LUTS = [
  { id: 'clean_studio', name: 'Clean Studio' },
  { id: 'warm_creator', name: 'Warm Creator' },
  { id: 'teal_and_orange', name: 'Teal & Orange' },
  { id: 'vibrant_pop', name: 'Vibrant Pop' },
  { id: 'cyberpunk', name: 'Cyberpunk Night' },
];

export default function StylePresets({
  selectedStyle,
  onSelectStyle,
  selectedLUT,
  onSelectLUT,
}: StylePresetsProps) {
  return (
    <div className="space-y-4">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
        Kinetic Subtitle Presets
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {STYLES.map((st) => {
          const Icon = st.icon;
          const isSelected = selectedStyle === st.id;

          return (
            <div
              key={st.id}
              onClick={() => onSelectStyle(st.id)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-indigo-950/60 border-indigo-500 shadow-lg shadow-indigo-500/20 scale-[1.02]'
                  : 'glass-panel border-surface-border hover:bg-surface-hover'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${st.color} flex items-center justify-center text-white`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-white">{st.name}</span>
                </div>
                <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-bold">
                  {st.badge}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{st.desc}</p>
            </div>
          );
        })}
      </div>

      {/* 1-Click Color LUT Grading */}
      <div className="pt-2">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          1-Click Cinematic Color LUTs
        </div>
        <div className="flex flex-wrap gap-2">
          {COLOR_LUTS.map((lut) => (
            <button
              key={lut.id}
              onClick={() => onSelectLUT(lut.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                selectedLUT === lut.id
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                  : 'bg-surface text-slate-300 border-surface-border hover:bg-surface-hover'
              }`}
            >
              {lut.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
