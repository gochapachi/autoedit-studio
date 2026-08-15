'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, Sparkles, Move } from 'lucide-react';

interface VideoPlayerProps {
  videoUrl?: string;
  subtitles?: any[];
  activeStyle?: string;
  aspectRatio?: '9:16' | '1:1' | '16:9';
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  hookBannerText?: string;
}

export default function VideoPlayer({
  videoUrl,
  subtitles = [],
  activeStyle = 'hormozi',
  aspectRatio = '9:16',
  currentTime,
  onTimeUpdate,
  hookBannerText = '',
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(15);
  const [activeWord, setActiveWord] = useState<string | null>(null);

  // Subtitle Drag Position (WYSIWYG)
  const [captionPos, setCaptionPos] = useState({ x: 50, y: 72 }); // % of frame
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      if (Math.abs(videoRef.current.currentTime - currentTime) > 0.3) {
        videoRef.current.currentTime = currentTime;
      }
    }
  }, [currentTime]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      onTimeUpdate(t);

      // Find active word for kinetic karaoke highlight
      if (subtitles && subtitles.length > 0) {
        const match = subtitles.find((w: any) => t >= w.start && t <= w.end);
        setActiveWord(match ? match.word : null);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 15);
    }
  };

  // Find active subtitle chunk (sentence window)
  const currentChunk = subtitles.filter(
    (w: any) => currentTime >= w.start - 0.2 && currentTime <= w.end + 0.8
  );

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      {/* 9:16 Phone Frame Container */}
      <div
        className={`relative rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800/80 bg-black flex items-center justify-center transition-all duration-300 ${
          aspectRatio === '9:16'
            ? 'w-[290px] h-[515px] sm:w-[320px] sm:h-[570px]'
            : aspectRatio === '1:1'
            ? 'w-[360px] h-[360px]'
            : 'w-[520px] h-[292px]'
        }`}
      >
        {/* Actual Video Tag */}
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            muted={isMuted}
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3 animate-pulse">
              <Sparkles className="w-8 h-8" />
            </div>
            <div className="text-sm font-bold text-slate-200">Live Video Preview</div>
            <p className="text-xs text-slate-500 mt-1">Drop a clip to see live 9:16 reframe & captions</p>
          </div>
        )}

        {/* Top 3-Second Hook Headline Banner */}
        {hookBannerText && currentTime < 3.5 && (
          <div className="absolute top-6 inset-x-3 z-30 animate-bounce">
            <div className="bg-black/85 backdrop-blur-md px-3 py-2 rounded-xl border border-yellow-500/40 text-center shadow-2xl">
              <span className="text-xs font-black uppercase tracking-wider text-yellow-400 font-sans">
                {hookBannerText}
              </span>
            </div>
          </div>
        )}

        {/* WYSIWYG Draggable Subtitle Overlay */}
        {currentChunk.length > 0 && (
          <div
            className="absolute z-20 cursor-move select-none px-4 py-2 transition-transform duration-75"
            style={{
              left: `${captionPos.x}%`,
              top: `${captionPos.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-center">
              {currentChunk.map((w: any, idx: number) => {
                const isHighlight = currentTime >= w.start && currentTime <= w.end;

                if (activeStyle === 'hormozi') {
                  return (
                    <span
                      key={idx}
                      className={`font-black text-lg tracking-tight uppercase transition-all duration-100 ${
                        isHighlight
                          ? 'text-yellow-400 scale-125 drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)] animate-pulse'
                          : 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]'
                      }`}
                      style={{ WebkitTextStroke: '1px black' }}
                    >
                      {w.word}
                    </span>
                  );
                } else if (activeStyle === 'mrbeast') {
                  return (
                    <span
                      key={idx}
                      className={`font-extrabold text-xl uppercase px-1 py-0.5 rounded transition-all ${
                        isHighlight
                          ? 'bg-emerald-500 text-black scale-125 shadow-lg'
                          : 'text-white bg-black/60'
                      }`}
                    >
                      {w.word}
                    </span>
                  );
                } else {
                  return (
                    <span
                      key={idx}
                      className={`text-sm font-semibold transition-all ${
                        isHighlight ? 'text-white underline underline-offset-4 decoration-indigo-400' : 'text-slate-400'
                      }`}
                    >
                      {w.word}
                    </span>
                  );
                }
              })}
            </div>
          </div>
        )}

        {/* Play Overlay Button on Hover */}
        <div
          onClick={togglePlay}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
        >
          <div className="w-14 h-14 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-xl">
            {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
          </div>
        </div>
      </div>

      {/* Media Scrubbing Bar & Controls */}
      <div className="w-full max-w-[320px] flex items-center justify-between gap-3 px-2">
        <button
          onClick={togglePlay}
          className="p-2 rounded-xl bg-surface hover:bg-surface-hover text-slate-200 border border-surface-border transition"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        {/* Time Scrubber */}
        <input
          type="range"
          min="0"
          max={duration || 15}
          step="0.05"
          value={currentTime}
          onChange={(e) => onTimeUpdate(parseFloat(e.target.value))}
          className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
        />

        <div className="text-[11px] font-mono text-slate-400 w-12 text-right">
          {currentTime.toFixed(1)}s
        </div>

        <button
          onClick={() => setIsMuted(!isMuted)}
          className="p-2 rounded-xl bg-surface hover:bg-surface-hover text-slate-400 hover:text-white border border-surface-border transition"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
