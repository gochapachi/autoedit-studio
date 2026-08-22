'use client';

import React, { useState, useEffect } from 'react';
import { apiUrl } from '@/lib/api';
import {
  History, X, Star, Trash2, Search, ArrowRight, Sparkles, 
  Youtube, FileText, Clock, RefreshCw, Check, Zap, ExternalLink 
} from 'lucide-react';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTopic: (topic: string, niche?: string) => void;
  onLoadScript: (script: any) => void;
  onLoadBrandProfile?: (profile: any) => void;
}

export default function HistoryDrawer({
  isOpen,
  onClose,
  onSelectTopic,
  onLoadScript,
  onLoadBrandProfile
}: HistoryDrawerProps) {
  const [activeTab, setActiveTab] = useState<'scripts' | 'topics' | 'youtube'>('scripts');
  const [searchQuery, setSearchQuery] = useState('');
  const [historyData, setHistoryData] = useState<{
    scripts: any[];
    topics: any[];
    youtube_audits: any[];
  }>({
    scripts: [],
    topics: [],
    youtube_audits: []
  });
  const [loading, setLoading] = useState(false);
  const [loadedItemId, setLoadedItemId] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/history'));
      if (res.ok) {
        const data = await res.json();
        setHistoryData(data);
      }
    } catch (e) {
      console.warn('Could not fetch history from backend, checking localStorage fallback');
      const local = localStorage.getItem('autoedit_history');
      if (local) {
        setHistoryData(JSON.parse(local));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  const handleToggleFavorite = async (category: string, itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(apiUrl('/api/history/toggle-favorite'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, item_id: itemId })
      });
      fetchHistory();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteItem = async (category: string, itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(apiUrl('/api/history/delete-item'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, item_id: itemId })
      });
      fetchHistory();
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  // Filter items by search query
  const filteredScripts = (historyData.scripts || []).filter(s => 
    s.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.topic?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.script?.hook?.spoken_text?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTopics = (historyData.topics || []).filter(t => 
    t.topic?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.niche?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAudits = (historyData.youtube_audits || []).filter(a => 
    a.channel_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.channel_url?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm transition-all duration-300 animate-fadeIn" onClick={onClose}>
      <div 
        className="fixed inset-y-0 right-0 max-w-xl w-full bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 animate-slideLeft"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Creator Memory & Work History
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-mono border border-emerald-200 font-bold">
                  100% Local
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Persistent history of topics, custom-refined scripts & YouTube audits
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition border border-slate-200 shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector & Search */}
        <div className="p-4 border-b border-slate-200 space-y-3 bg-white">
          <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('scripts')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'scripts'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Saved Scripts ({historyData.scripts?.length || 0})</span>
            </button>
            <button
              onClick={() => setActiveTab('topics')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'topics'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Topics ({historyData.topics?.length || 0})</span>
            </button>
            <button
              onClick={() => setActiveTab('youtube')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'youtube'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Youtube className="w-3.5 h-3.5" />
              <span>Channel Audits ({historyData.youtube_audits?.length || 0})</span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {loading && (
            <div className="flex items-center justify-center py-12 text-xs text-slate-500 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
              <span>Syncing with local engine...</span>
            </div>
          )}

          {/* TAB 1: SAVED SCRIPTS */}
          {activeTab === 'scripts' && !loading && (
            <div className="space-y-3">
              {filteredScripts.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-500">
                  No scripts found in history. Generate or refine a script to see it here!
                </div>
              ) : (
                filteredScripts.map((item) => {
                  const isLoaded = loadedItemId === item.id;
                  const isCustom = item.script_type === 'custom_refined';
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 transition group relative space-y-2.5 bg-white shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isCustom 
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                                : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            }`}>
                              {isCustom ? '✍️ Custom Refined' : '✨ AI Generated'}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {item.duration || 45}s Short
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white mt-1">
                            {item.title}
                          </h4>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handleToggleFavorite('scripts', item.id, e)}
                            className={`p-1.5 rounded-lg transition ${
                              item.favorite
                                ? 'text-amber-400 bg-amber-400/10'
                                : 'text-slate-500 hover:text-amber-400 hover:bg-surface'
                            }`}
                          >
                            <Star className="w-3.5 h-3.5 fill-current" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteItem('scripts', item.id, e)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-surface transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Hook Preview */}
                      {item.script?.hook?.spoken_text && (
                        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-surface-border/60 text-xs">
                          <span className="text-amber-400 font-bold text-[10px] uppercase block mb-0.5">
                            Hook:
                          </span>
                          <p className="text-slate-300 line-clamp-2 italic">
                            "{item.script.hook.spoken_text}"
                          </p>
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-slate-500">
                          {new Date(item.created_at * 1000).toLocaleDateString()} at {new Date(item.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>

                        <button
                          onClick={() => {
                            onLoadScript(item.script || item);
                            if (item.topic) {
                              onSelectTopic(item.topic);
                            }
                            setLoadedItemId(item.id);
                            setTimeout(() => {
                              setLoadedItemId(null);
                              onClose();
                            }, 500);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition"
                        >
                          {isLoaded ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Zap className="w-3.5 h-3.5" />}
                          <span>{isLoaded ? 'Loaded!' : 'Load to Studio'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: PREVIOUS TOPICS */}
          {activeTab === 'topics' && !loading && (
            <div className="space-y-2.5">
              {filteredTopics.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-500">
                  No topics in memory yet. Researched topics will automatically be saved here.
                </div>
              ) : (
                filteredTopics.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-slate-900/60 border border-surface-border hover:border-cyan-500/40 transition flex items-center justify-between gap-3 group"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {item.niche && (
                          <span className="px-2 py-0.2 rounded bg-cyan-500/10 text-cyan-400 text-[10px] font-bold border border-cyan-500/20">
                            {item.niche}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500">
                          {new Date(item.created_at * 1000).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white mt-1">
                        {item.topic}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleToggleFavorite('topics', item.id, e)}
                        className={`p-1.5 rounded-lg transition ${
                          item.favorite ? 'text-amber-400 bg-amber-400/10' : 'text-slate-500 hover:text-amber-400'
                        }`}
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                      </button>

                      <button
                        onClick={(e) => handleDeleteItem('topics', item.id, e)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          onSelectTopic(item.topic, item.niche);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1 transition ml-1"
                      >
                        <span>Use Topic</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: YOUTUBE CHANNEL AUDITS */}
          {activeTab === 'youtube' && !loading && (
            <div className="space-y-3">
              {filteredAudits.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-500">
                  No YouTube channel audits in memory yet. Run a channel audit in Research Hub!
                </div>
              ) : (
                filteredAudits.map((item) => {
                  const analysis = item.data?.analysis || {};
                  return (
                    <div
                      key={item.id}
                      className="glass-panel p-4 rounded-2xl border border-surface-border hover:border-rose-500/40 transition space-y-3 bg-slate-900/60"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                            <Youtube className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white">
                              {item.channel_title}
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              <span>{item.subscriber_count}</span>
                              <span>•</span>
                              <span>{item.video_count || 5} top videos analyzed</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handleDeleteItem('youtube_audits', item.id, e)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Content Pillars */}
                      {analysis.content_pillars && (
                        <div className="space-y-1 text-xs">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Core Content Pillars:</span>
                          <div className="flex flex-wrap gap-1">
                            {analysis.content_pillars.map((p: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-surface border border-surface-border text-[11px] text-slate-300">
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-surface-border">
                        <span className="text-[10px] text-slate-500">
                          {new Date(item.created_at * 1000).toLocaleDateString()}
                        </span>

                        <div className="flex items-center gap-2">
                          {onLoadBrandProfile && item.data?.suggested_brand_profile && (
                            <button
                              onClick={() => {
                                onLoadBrandProfile(item.data.suggested_brand_profile);
                                onClose();
                              }}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-surface-border transition"
                            >
                              Apply to Brand Brain
                            </button>
                          )}

                          {analysis.viral_topic_opportunities?.[0] && (
                            <button
                              onClick={() => {
                                onSelectTopic(analysis.viral_topic_opportunities[0].topic);
                                onClose();
                              }}
                              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1"
                            >
                              <span>Use Top Opportunity</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
