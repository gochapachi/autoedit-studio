'use client';

import React, { useState } from 'react';
import { Download, CheckCircle2, Film, FileCode, Sparkles, Loader2, X, Cpu } from 'lucide-react';

interface ExportModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onRenderNVENC: () => Promise<any>;
  renderedUrl?: string;
}

export default function ExportModal({
  projectId,
  isOpen,
  onClose,
  onRenderNVENC,
  renderedUrl,
}: ExportModalProps) {
  const [isRendering, setIsRendering] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(renderedUrl || '');
  const [renderStats, setRenderStats] = useState<any>(null);

  if (!isOpen) return null;

  const handleStartRender = async () => {
    setIsRendering(true);
    try {
      const res = await onRenderNVENC();
      if (res && res.output_url) {
        setDownloadUrl(res.output_url);
        setRenderStats(res.render_details);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRendering(false);
    }
  };

  const handleDownloadMP4 = () => {
    if (!downloadUrl) return;
    const link = document.createElement('a');
    link.href = `http://127.0.0.1:8000${downloadUrl}`;
    link.download = `viral_short_${projectId}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-lg glass-panel p-6 rounded-3xl border border-surface-border space-y-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Hardware GPU Export</h3>
            <p className="text-xs text-slate-400">NVIDIA NVENC 1080x1920 60fps (~6s render)</p>
          </div>
        </div>

        {/* Render Action or Completed State */}
        {!downloadUrl ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-surface-border space-y-2 text-xs text-slate-300">
              <div className="flex items-center justify-between font-semibold text-white">
                <span>Output Resolution:</span>
                <span className="font-mono text-indigo-300">1080 x 1920 (9:16 Vertical)</span>
              </div>
              <div className="flex items-center justify-between font-semibold text-white">
                <span>Encoder Acceleration:</span>
                <span className="font-mono text-emerald-400 flex items-center gap-1">
                  <Cpu className="w-3 h-3" /> NVIDIA NVENC (p5 high quality)
                </span>
              </div>
              <div className="flex items-center justify-between font-semibold text-white">
                <span>Audio Loudness:</span>
                <span className="font-mono text-cyan-300">-14 LUFS (EBU R128 Compliant)</span>
              </div>
            </div>

            <button
              onClick={handleStartRender}
              disabled={isRendering}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-600 hover:to-pink-700 text-white text-sm font-bold shadow-xl shadow-indigo-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {isRendering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Compositing Video with GPU NVENC (~6s)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Start Fast NVENC Render</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h4 className="text-base font-bold text-white">Render Completed Successfully!</h4>
              <p className="text-xs text-slate-400 mt-1">Ready to download and post to YouTube Shorts, Reels & TikTok.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleDownloadMP4}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition"
              >
                <Download className="w-4 h-4" />
                <span>Download MP4 Video</span>
              </button>

              <button
                onClick={onClose}
                className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition border border-surface-border"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
