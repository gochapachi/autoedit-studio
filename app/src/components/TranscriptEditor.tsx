"use client";

import { useState } from "react";
import { Transcript } from "@/lib/api";
import { Button, Spinner } from "@/components/ui";

/**
 * Shared word-level transcript editor: tap words to cut them from the final
 * video, or switch to Fix-words mode to correct misheard subtitle text.
 */
export default function TranscriptEditor({
  words,
  deleted,
  setDeleted,
  currentTime,
  onSeek,
  onEditWord,
  onAIFix,
  aiFixing,
  hint,
}: {
  words: Transcript["words"];
  deleted: Set<number>;
  setDeleted: (s: Set<number>) => void;
  currentTime?: number;
  onSeek?: (t: number) => void;
  onEditWord: (idx: number, text: string) => void;
  onAIFix?: () => void;
  aiFixing?: boolean;
  hint?: string;
}) {
  const [editMode, setEditMode] = useState<"cut" | "fix">("cut");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  function toggleWord(idx: number) {
    const next = new Set(deleted);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setDeleted(next);
  }

  if (!words?.length) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <div className="text-3xl mb-2">🎧</div>
        <p className="text-sm text-slate-400">No transcript available for this video.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {onAIFix && (
          <Button variant="secondary" size="sm" onClick={onAIFix} loading={aiFixing}>
            🤖 Fix words with AI
          </Button>
        )}
        <div className="ml-auto flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
          <button
            onClick={() => setEditMode("cut")}
            className={`rounded-md px-3 py-1.5 transition ${
              editMode === "cut" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"
            }`}
          >
            ✂️ Tap to cut
          </button>
          <button
            onClick={() => setEditMode("fix")}
            className={`rounded-md px-3 py-1.5 transition ${
              editMode === "fix" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"
            }`}
          >
            ✏️ Fix words
          </button>
        </div>
      </div>

      {hint && <p className="text-xs text-slate-400 mb-2">{hint}</p>}
      {editMode === "fix" && (
        <p className="text-xs text-slate-400 mb-2">
          Tap a word to correct its spelling — timing stays the same.
        </p>
      )}

      <div className="max-h-[320px] overflow-y-auto leading-loose">
        {words.map((w, i) => {
          const isDeleted = deleted.has(i);
          const active =
            currentTime != null && currentTime >= w.start && currentTime <= w.end;
          if (editingIdx === i) {
            return (
              <input
                key={i}
                autoFocus
                defaultValue={w.word}
                onBlur={(e) => onEditWord(i, e.target.value.trim() || w.word)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onEditWord(i, e.currentTarget.value.trim() || w.word);
                  if (e.key === "Escape") setEditingIdx(null);
                }}
                className="rounded-md border border-indigo-400 px-1 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500 w-28"
              />
            );
          }
          return (
            <span
              key={i}
              onClick={() => {
                if (editMode === "fix") setEditingIdx(i);
                else toggleWord(i);
              }}
              title={
                editMode === "fix"
                  ? "Tap to correct this word"
                  : isDeleted
                  ? "Click to keep"
                  : "Click to cut"
              }
              className={`cursor-pointer rounded px-1 transition select-none ${
                isDeleted
                  ? "line-through text-slate-300"
                  : active
                  ? "bg-indigo-100 text-indigo-800"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {w.word}{" "}
            </span>
          );
        })}
      </div>
    </div>
  );
}
