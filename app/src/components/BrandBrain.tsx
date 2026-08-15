'use client';

import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, Building, Target, Volume2, Key, Check, ChevronRight } from 'lucide-react';

interface BrandProfile {
  name: string;
  niche: string;
  audience: string;
  voice: string;
  cta_goal: string;
  gemini_api_key?: string;
}

interface BrandBrainProps {
  profile: BrandProfile;
  setProfile: React.Dispatch<React.SetStateAction<BrandProfile>>;
  onNext: () => void;
}

export const DEMO_PRESETS: Record<string, BrandProfile> = {
  saas: {
    name: 'ScaleFlow AI',
    niche: 'B2B Software & AI Automation',
    audience: 'Startup Founders & Agency Owners',
    voice: 'High-Energy, Technical Authority & Fast-Paced',
    cta_goal: 'Comment "AUTOMATE" for free 10-step template',
  },
  fitness: {
    name: 'IronMind Coaching',
    niche: 'Fat Loss & Muscle Building',
    audience: 'Busy Working Professionals (30-45 yrs)',
    voice: 'Motivating, Direct, No-BS Science-Backed',
    cta_goal: 'Click link in bio for free macro calculator',
  },
  realestate: {
    name: 'Prime Estate Media',
    niche: 'Luxury Property Investing & House Flipping',
    audience: 'First-time Homebuyers & Real Estate Investors',
    voice: 'Sophisticated, Trustworthy, Wealth Building',
    cta_goal: 'DM me "INVEST" for our off-market listings list',
  },
  ecommerce: {
    name: 'Veloce Dropship',
    niche: 'Viral TikTok Shop Products',
    audience: 'Gen-Z & Online Shoppers',
    voice: 'Hyper Energetic, Meme-Savvy & Fun',
    cta_goal: 'Link in bio for 40% OFF flash sale',
  }
};

export default function BrandBrain({ profile, setProfile, onNext }: BrandBrainProps) {
  const [apiKey, setApiKey] = useState(profile.gemini_api_key || '');
  const [isSaved, setIsSaved] = useState(false);

  const loadPreset = (key: string) => {
    const p = DEMO_PRESETS[key];
    if (p) {
      setProfile((prev) => ({ ...prev, ...p }));
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    }
  };

  const handleSave = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/brand-brain/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profile, gemini_api_key: apiKey }),
      });
      if (res.ok) {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2500);
      }
    } catch (e) {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-surface-border relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Brand Brain & Business Intake
              </h2>
              <p className="text-sm text-slate-400">
                Configure your brand persona once. All AI scripts, caption palettes, and hooks will adapt automatically.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium mr-1">Load 1-Click Demo:</span>
            <button
              onClick={() => loadPreset('saas')}
              className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-hover text-xs font-semibold text-indigo-300 border border-surface-border transition"
            >
              💻 SaaS
            </button>
            <button
              onClick={() => loadPreset('fitness')}
              className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-hover text-xs font-semibold text-emerald-300 border border-surface-border transition"
            >
              💪 Fitness
            </button>
            <button
              onClick={() => loadPreset('realestate')}
              className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-hover text-xs font-semibold text-amber-300 border border-surface-border transition"
            >
              🏡 Real Estate
            </button>
          </div>
        </div>
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="glass-panel p-5 rounded-2xl border border-surface-border space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-2">
              <Building className="w-3.5 h-3.5 text-indigo-400" /> Business / Channel Name
            </label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              placeholder="e.g. ScaleFlow AI"
              className="w-full bg-slate-900/90 border border-surface-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Industry & Niche
            </label>
            <input
              type="text"
              value={profile.niche}
              onChange={(e) => setProfile({ ...profile, niche: e.target.value })}
              placeholder="e.g. AI Video Marketing & Content Automation"
              className="w-full bg-slate-900/90 border border-surface-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-pink-400" /> Target Audience
            </label>
            <input
              type="text"
              value={profile.audience}
              onChange={(e) => setProfile({ ...profile, audience: e.target.value })}
              placeholder="e.g. Content Creators, Agency Founders, Solopreneurs"
              className="w-full bg-slate-900/90 border border-surface-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-surface-border space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 text-amber-400" /> Brand Tone & Voice
            </label>
            <input
              type="text"
              value={profile.voice}
              onChange={(e) => setProfile({ ...profile, voice: e.target.value })}
              placeholder="e.g. High-Energy, Authoritative, Fast-Paced (Hormozi style)"
              className="w-full bg-slate-900/90 border border-surface-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Core Call-to-Action (CTA) Goal
            </label>
            <input
              type="text"
              value={profile.cta_goal}
              onChange={(e) => setProfile({ ...profile, cta_goal: e.target.value })}
              placeholder="e.g. Comment 'GROWTH' for free template / Link in bio"
              className="w-full bg-slate-900/90 border border-surface-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-yellow-400" /> Gemini API Key (Optional)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy... (Leave empty to use built-in models)"
              className="w-full bg-slate-900/90 border border-surface-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handleSave}
          className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition border border-surface-border flex items-center gap-2"
        >
          {isSaved ? <Check className="w-4 h-4 text-emerald-400" /> : null}
          <span>{isSaved ? 'Saved to Brand Brain!' : 'Save Brand Profile'}</span>
        </button>

        <button
          onClick={() => {
            handleSave();
            onNext();
          }}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-sm font-bold shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition"
        >
          <span>Continue to SEO & Script Generator</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
