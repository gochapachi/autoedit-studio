'use client';

import React, { useState } from 'react';
import { Search, TrendingUp, Hash, Flame, ArrowRight, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

interface ResearchProps {
  niche: string;
  onSelectTopic: (topic: string) => void;
  onNext: () => void;
}

export default function ResearchHub({ niche, onSelectTopic, onNext }: ResearchProps) {
  const [topicInput, setTopicInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [researchData, setResearchData] = useState<any>(null);
  const [selectedTopic, setSelectedTopic] = useState('');

  const handleResearch = async () => {
    const queryTopic = topicInput.trim() || 'AI Automation for Creators';
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/gemini/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: niche || 'General Business', topic: queryTopic }),
      });
      const data = await res.json();
      setResearchData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Search Box */}
      <div className="glass-panel p-6 rounded-3xl border border-surface-border space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Gemini SEO & YouTube Channel Research</h3>
            <p className="text-xs text-slate-400">
              Discover high-demand, low-competition keywords and viral competitor hook angles for {niche || 'your niche'}.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
              placeholder="e.g. 3 tools that automate video editing in 2026..."
              className="w-full bg-slate-900/90 border border-surface-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition"
            />
          </div>
          <button
            onClick={handleResearch}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold shadow-lg shadow-cyan-600/25 flex items-center gap-2 transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{loading ? 'Analyzing...' : 'Discover Trends'}</span>
          </button>
        </div>
      </div>

      {/* Results Display */}
      {researchData && (
        <div className="space-y-5 animate-fadeIn">
          {/* Trending Search Queries */}
          <div className="glass-panel p-5 rounded-2xl border border-surface-border space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" /> High-Demand YouTube Shorts / TikTok Queries
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {researchData.trending_queries?.map((item: any, idx: number) => {
                const isSelected = selectedTopic === item.query;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedTopic(item.query);
                      onSelectTopic(item.query);
                    }}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-cyan-950/60 border-cyan-500 shadow-md shadow-cyan-500/20'
                        : 'bg-surface/60 border-surface-border hover:bg-surface-hover'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                        {item.query}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                        <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                          {item.search_volume} Volume
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                          {item.competition} Comp
                        </span>
                      </div>
                    </div>
                    {isSelected ? (
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    ) : (
                      <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Competitor Hook Angles & Keywords */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-panel p-4 rounded-2xl border border-surface-border space-y-2.5">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Flame className="w-3.5 h-3.5 text-rose-400" /> Viral Competitor Angles
              </h4>
              <div className="space-y-2">
                {researchData.competitor_angles?.map((angle: any, i: number) => (
                  <div key={i} className="p-2.5 rounded-xl bg-slate-900/60 border border-surface-border text-xs">
                    <div className="font-bold text-indigo-300">{angle.angle_title}</div>
                    <div className="text-slate-400 mt-0.5">{angle.why_it_works}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-surface-border space-y-2.5">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-yellow-400" /> High-CTR Keyword Tags
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {researchData.keyword_opportunities?.map((kw: string, i: number) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-surface border border-surface-border text-xs text-yellow-300 font-mono"
                  >
                    {kw}
                  </span>
                ))}
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={onNext}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 text-white text-xs font-bold shadow-md flex items-center gap-2 transition"
                >
                  <span>Generate Script with Selected Topic</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
