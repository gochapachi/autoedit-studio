'use client';

import React, { useState } from 'react';
import { Copy, Check, Hash, FileText, Sparkles, Share2 } from 'lucide-react';

interface SocialCopyProps {
  socialData?: any;
}

export default function SocialCopy({ socialData }: SocialCopyProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const titles = socialData?.viral_titles || [
    'The #1 Secret to Automate Video Editing 🤯',
    'How I Create 30 Viral Shorts in 1 Hour (AI Workflow)',
    'Stop Wasting Hours on Manual Cuts ❌',
  ];

  const hashtags = socialData?.hashtags?.join(' ') || '#shorts #reels #videoediting #ai #contentcreator #viral #growth';
  const description = socialData?.seo_description || 'Discover how to turn raw footage into high-retention viral shorts in seconds using local AI.\n\nLike and subscribe for more creator breakdowns!';

  return (
    <div className="space-y-4">
      {/* Clickable Viral Titles */}
      <div className="glass-panel p-4 rounded-2xl border border-surface-border space-y-2.5">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-yellow-400" /> High-CTR Clickable Titles (Click to Copy)
        </div>
        <div className="space-y-2">
          {titles.map((title: string, idx: number) => (
            <div
              key={idx}
              onClick={() => copyToClipboard(title, `title_${idx}`)}
              className="p-2.5 rounded-xl bg-slate-900/80 border border-surface-border hover:border-indigo-500/40 text-xs font-semibold text-white cursor-pointer transition flex items-center justify-between group"
            >
              <span>{title}</span>
              {copiedKey === `title_${idx}` ? (
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-white shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* SEO Description & Chapters */}
      <div className="glass-panel p-4 rounded-2xl border border-surface-border space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-cyan-400" /> SEO Description & Timestamps
          </div>
          <button
            onClick={() => copyToClipboard(description, 'desc')}
            className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            {copiedKey === 'desc' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copiedKey === 'desc' ? 'Copied' : 'Copy Description'}</span>
          </button>
        </div>
        <textarea
          readOnly
          value={description}
          rows={3}
          className="w-full bg-slate-900/80 border border-surface-border rounded-xl p-2.5 text-xs text-slate-300 font-sans focus:outline-none resize-none"
        />
      </div>

      {/* Hashtags */}
      <div className="glass-panel p-4 rounded-2xl border border-surface-border space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-pink-400" /> Trending Hashtags
          </div>
          <button
            onClick={() => copyToClipboard(hashtags, 'tags')}
            className="text-[11px] font-bold text-pink-400 hover:text-pink-300 flex items-center gap-1"
          >
            {copiedKey === 'tags' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copiedKey === 'tags' ? 'Copied' : 'Copy All Tags'}</span>
          </button>
        </div>
        <div className="p-2 rounded-xl bg-slate-900/80 border border-surface-border text-xs text-pink-300/90 font-mono">
          {hashtags}
        </div>
      </div>
    </div>
  );
}
