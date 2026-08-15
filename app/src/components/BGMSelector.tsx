'use client';

import React, { useState } from 'react';
import { Music, Search, Volume2, Sparkles, Loader2, CheckCircle2, Play, Pause } from 'lucide-react';

interface BGMSelectorProps {
  selectedBGM: string;
  onSelectBGM: (bgm: string) => void;
}

export const MOOD_PRESETS = [
  { id: 'lofi', name: 'Lo-Fi Chill Beats', desc: 'Relaxed, ambient, gentle study groove', query: 'lofi chill hip hop' },
  { id: 'hype', name: 'Viral Hype Trap', desc: 'Punchy bass, fast tempo, high excitement', query: 'energetic trap beat' },
  { id: 'cyberpunk', name: 'Dark Cyber Synth', desc: 'Futuristic synthwave, tech authority', query: 'cyberpunk synthwave' },
  { id: 'acoustic', name: 'Warm Acoustic Story', desc: 'Emotional storytelling, subtle guitar', query: 'acoustic corporate inspirational' },
];

export default function BGMSelector({ selectedBGM, onSelectBGM }: BGMSelectorProps) {
  const [customInput, setCustomInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchedTrack, setFetchedTrack] = useState<any>(null);

  const handleFetch = async () => {
    if (!customInput.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/bgm/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query_or_url: customInput.trim() }),
      });
      const data = await res.json();
      setFetchedTrack(data);
      onSelectBGM(data.file_path || customInput);
    } catch (e) {
      console.error(e);
      onSelectBGM(customInput);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Smart Background Music & yt-dlp Ingestion
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
          <Sparkles className="w-3 h-3" /> Auto-Ducking (-18dB) Active
        </div>
      </div>

      {/* Mood Preset Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {MOOD_PRESETS.map((m) => {
          const isSelected = selectedBGM === m.query || selectedBGM === m.name;
          return (
            <div
              key={m.id}
              onClick={() => onSelectBGM(m.query)}
              className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                isSelected
                  ? 'bg-indigo-950/60 border-indigo-500 shadow-md shadow-indigo-500/20'
                  : 'glass-panel border-surface-border hover:bg-surface-hover'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface border border-surface-border flex items-center justify-center text-indigo-400">
                  <Music className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">{m.name}</div>
                  <div className="text-[11px] text-slate-400">{m.desc}</div>
                </div>
              </div>
              {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Custom YouTube Link Input */}
      <div className="glass-panel p-3 rounded-xl border border-surface-border space-y-2">
        <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
          <Search className="w-3 h-3 text-cyan-400" /> Or paste any YouTube / SoundCloud Link:
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="https://youtube.com/watch?v=... or song title"
            className="flex-1 bg-slate-900 border border-surface-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleFetch}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Music className="w-3.5 h-3.5" />}
            <span>{loading ? 'Downloading...' : 'Fetch BGM'}</span>
          </button>
        </div>

        {fetchedTrack && (
          <div className="p-2 rounded-lg bg-slate-900/80 border border-surface-border text-xs text-slate-300 flex items-center justify-between">
            <span className="truncate font-semibold text-indigo-300">{fetchedTrack.title}</span>
            <span className="text-[10px] font-mono text-emerald-400 shrink-0">
              {fetchedTrack.beats ? `${fetchedTrack.beats.tempo} BPM` : 'Ready'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
