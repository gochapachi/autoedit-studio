"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiPost,
  apiFetch,
  API_BASE,
  ModelsResponse,
  UnslothSearchResponse,
  UnslothModel,
} from "@/lib/api";
import { Button, Spinner } from "@/components/ui";

/**
 * AI model picker: shows installed Ollama models, searches Unsloth's GGUF
 * library live, and installs models with a real download progress bar.
 */
export default function ModelPicker({
  selectedModel,
  onModelChange,
}: {
  selectedModel: string;
  onModelChange: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [query, setQuery] = useState("");
  const [unsloth, setUnsloth] = useState<UnslothModel[]>([]);
  const [loadingUnsloth, setLoadingUnsloth] = useState(false);
  const [sortSmallest, setSortSmallest] = useState(false);
  const [pulling, setPulling] = useState<{ model: string; pct: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const shortName = (n: string) => n.replace(/^hf\.co\//, "").replace(/:Q4_K_M$/, "");
  const sizeGB = (s?: string) => {
    const m = s?.match(/~?([\d.]+)(GB|MB)/);
    if (!m) return 999;
    return m[2] === "GB" ? parseFloat(m[1]) : parseFloat(m[1]) / 1000;
  };

  const refreshModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const res = await apiFetch<ModelsResponse>("/api/local-ai/models");
      setInstalled(res.models.map((m) => m.name));
    } catch {
      setInstalled([]);
    } finally {
      setLoadingModels(false);
    }
  }, []);

  const searchUnsloth = useCallback(async (q: string) => {
    setLoadingUnsloth(true);
    try {
      const res = await apiFetch<UnslothSearchResponse>(
        `/api/local-ai/unsloth-models${q ? `?q=${encodeURIComponent(q)}` : ""}`
      );
      setUnsloth(res.models);
    } catch {
      setUnsloth([]);
      setNote("Couldn't search for models (offline?). You can still use installed models.");
    } finally {
      setLoadingUnsloth(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    refreshModels();
    searchUnsloth("");
  }, [open, refreshModels, searchUnsloth]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Live pull progress over the engine's WebSocket
  useEffect(() => {
    if (!pulling) return;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(API_BASE.replace(/^http/, "ws") + "/ws/progress");
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.step === "pull" && data.project_id === pulling.model) {
            const pct = typeof data.percentage === "number" ? data.percentage : 0;
            setPulling((p) => (p && p.model === data.project_id ? { ...p, pct } : p));
            if (pct >= 100) {
              setNote(`${shortName(pulling.model)} installed ✓`);
              onModelChange(pulling.model);
              setPulling(null);
              refreshModels();
              searchUnsloth(query);
            }
          }
        } catch {
          // ignore malformed frames
        }
      };
    } catch {
      // fall back to polling below
    }
    // Poll as a safety net in case the WS frame is missed
    const poll = setInterval(() => {
      apiFetch<ModelsResponse>("/api/local-ai/models")
        .then((res) => {
          const names = res.models.map((m) => m.name);
          setInstalled(names);
          if (pulling && names.some((n) => n.toLowerCase() === pulling.model.toLowerCase())) {
            setNote(`${shortName(pulling.model)} installed ✓`);
            onModelChange(pulling.model);
            setPulling(null);
            searchUnsloth(query);
          }
        })
        .catch(() => null);
    }, 4000);
    return () => {
      ws?.close();
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulling?.model]);

  async function install(model: string) {
    setNote(null);
    setPulling({ model, pct: 0 });
    try {
      const res = await apiPost<{ status: string }>("/api/local-ai/pull-model", {
        model_name: model,
      });
      if (res.status === "already_installed") {
        setNote(`${shortName(model)} is already installed ✓`);
        onModelChange(model);
        setPulling(null);
        refreshModels();
      } else if (res.status === "already_downloading") {
        setNote(`${shortName(model)} is already downloading…`);
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Install failed.");
      setPulling(null);
    }
  }

  const sorted = sortSmallest
    ? [...unsloth].sort((a, b) => sizeGB(a.size) - sizeGB(b.size))
    : unsloth;

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-indigo-300 max-w-[280px]"
      >
        <span className="text-base">🧠</span>
        <span className="font-medium truncate">
          {selectedModel ? shortName(selectedModel) : "AI model: Auto"}
        </span>
        <span className="text-slate-400">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[380px] max-w-[90vw] rounded-2xl border border-slate-200 bg-white shadow-xl p-4 text-left">
          {/* Installed models */}
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
            Installed on this PC
          </div>
          {loadingModels ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
              <Spinner /> Loading…
            </div>
          ) : installed.length === 0 ? (
            <p className="text-sm text-slate-400 py-1">
              None yet — pick one below to download.
            </p>
          ) : (
            <div className="max-h-36 overflow-y-auto space-y-1 mb-3">
              <button
                onClick={() => onModelChange("")}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm ${
                  !selectedModel ? "bg-indigo-50 text-indigo-700 font-semibold" : "hover:bg-slate-50"
                }`}
              >
                Auto (best available)
              </button>
              {installed.map((m) => (
                <button
                  key={m}
                  onClick={() => onModelChange(m)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm truncate ${
                    selectedModel === m
                      ? "bg-indigo-50 text-indigo-700 font-semibold"
                      : "hover:bg-slate-50"
                  }`}
                >
                  {shortName(m)}
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                Download more (by Unsloth)
              </div>
              <button
                onClick={() => setSortSmallest(!sortSmallest)}
                className="text-[11px] text-indigo-600 font-semibold"
              >
                {sortSmallest ? "Most popular" : "Smallest first"}
              </button>
            </div>
            <div className="flex gap-2 mb-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchUnsloth(query)}
                placeholder="Search e.g. qwen, gemma, llama…"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <Button size="sm" variant="secondary" onClick={() => searchUnsloth(query)}>
                Search
              </Button>
            </div>

            {loadingUnsloth ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                <Spinner /> Searching Unsloth library…
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1">
                {sorted.map((m) => {
                  const isPulling = pulling?.model === m.name;
                  const isInstalled =
                    m.installed || installed.some((i) => i.toLowerCase() === m.name.toLowerCase());
                  return (
                    <div
                      key={m.name}
                      className="rounded-lg border border-slate-100 px-3 py-2 hover:border-indigo-200"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-700 truncate">
                            {shortName(m.name)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {m.size ? `${m.size} download` : ""}
                            {m.downloads ? ` · ${Intl.NumberFormat("en", { notation: "compact" }).format(m.downloads)} downloads` : ""}
                          </div>
                        </div>
                        {isInstalled ? (
                          <button
                            onClick={() => onModelChange(m.name)}
                            className="shrink-0 text-xs font-semibold text-emerald-600"
                          >
                            ✓ Use
                          </button>
                        ) : isPulling ? (
                          <span className="shrink-0 text-xs font-semibold text-indigo-600 w-10 text-right">
                            {pulling!.pct}%
                          </span>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => install(m.name)}>
                            ⬇ Install
                          </Button>
                        )}
                      </div>
                      {isPulling && (
                        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 transition-all"
                            style={{ width: `${pulling!.pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {pulling && pulling.pct < 100 && (
            <p className="text-[11px] text-slate-400 mt-2">
              Downloading {shortName(pulling.model)}… you can keep using the app.
            </p>
          )}
          {note && <p className="text-[11px] text-emerald-600 mt-2">{note}</p>}
        </div>
      )}
    </div>
  );
}
