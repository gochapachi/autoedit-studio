"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  apiPost,
  BrandProfile,
  VideoScript,
  isOfflineFallback,
  friendlyReason,
  OllamaStatus,
} from "@/lib/api";
import { Button, Panel, ErrorBanner, OfflineBadge, Spinner, SectionTitle } from "@/components/ui";
import ModelPicker from "@/components/ModelPicker";

interface TrendingQuery {
  query: string;
  intent?: string;
  offline?: boolean;
}

interface SeoRadarResult {
  trending_queries: TrendingQuery[];
  is_realtime?: boolean;
  source?: string;
}

interface ChannelAuditResult {
  status: string;
  channel_title: string;
  videos?: { title: string; view_count?: number | null }[];
  analysis?: {
    viral_topic_opportunities?: { topic: string }[];
  };
}

interface Props {
  brandProfile: BrandProfile | null;
  topic: string;
  onTopicChange: (topic: string) => void;
  script: VideoScript | null;
  onScriptReady: (script: VideoScript) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
}

const DURATIONS = [
  { sec: 30, label: "30 sec" },
  { sec: 45, label: "45 sec" },
  { sec: 60, label: "1 min" },
];

export default function PlanStep({
  brandProfile,
  topic,
  onTopicChange,
  script,
  onScriptReady,
  selectedModel,
  onModelChange,
}: Props) {
  const [duration, setDuration] = useState(45);
  const [ideas, setIdeas] = useState<TrendingQuery[]>([]);
  const [ideasRealtime, setIdeasRealtime] = useState<boolean | null>(null);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [loadingScript, setLoadingScript] = useState(false);
  const [startingOllama, setStartingOllama] = useState(false);
  const [customNotes, setCustomNotes] = useState("");
  const [showResearch, setShowResearch] = useState(false);
  const [channelInput, setChannelInput] = useState("");
  const [channelAudit, setChannelAudit] = useState<ChannelAuditResult | null>(null);
  const [loadingChannel, setLoadingChannel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function findIdeas() {
    if (!topic.trim()) {
      setError("Type a topic first — what is your video about?");
      return;
    }
    setError(null);
    setLoadingIdeas(true);
    try {
      const res = await apiPost<SeoRadarResult>("/api/local-ai/research", {
        niche: brandProfile?.niche || "content creation",
        topic: topic.trim(),
      });
      setIdeas(res.trending_queries || []);
      setIdeasRealtime(res.is_realtime ?? false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load ideas.");
    } finally {
      setLoadingIdeas(false);
    }
  }

  async function auditChannel() {
    if (!channelInput.trim()) return;
    setError(null);
    setLoadingChannel(true);
    try {
      const res = await apiPost<ChannelAuditResult>("/api/research/youtube-channel", {
        channel_input: channelInput.trim(),
      });
      setChannelAudit(res);
      if (res.status === "failed") {
        setError(`Could not read that channel ("${channelInput}"). Check the name or link and try again.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Channel lookup failed.");
    } finally {
      setLoadingChannel(false);
    }
  }

  // One click = start Ollama if needed, then generate with the chosen model
  async function ensureOllamaStarted(): Promise<boolean> {
    setStartingOllama(true);
    try {
      const status = await apiPost<OllamaStatus>("/api/local-ai/ensure-ollama", { wait_seconds: 25 });
      if (!status.running && status.error) {
        setError(status.error);
      }
      return status.running;
    } catch {
      return false;
    } finally {
      setStartingOllama(false);
    }
  }

  async function generateScript(forTopic?: string) {
    const effectiveTopic = (forTopic ?? topic).trim();
    if (!effectiveTopic) {
      setError("Type a topic first — what is your video about?");
      return;
    }
    setError(null);
    await ensureOllamaStarted();
    setLoadingScript(true);
    try {
      const res = await apiPost<VideoScript & { reason?: string }>("/api/local-ai/generate-script", {
        topic: effectiveTopic,
        business_profile: brandProfile || {},
        target_duration_sec: duration,
        model_name: selectedModel || undefined,
      });
      const reasonMsg = friendlyReason(res.reason);
      if (reasonMsg) setError(reasonMsg);
      if (!forTopic) onTopicChange(effectiveTopic);
      onScriptReady(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Script generation failed.");
    } finally {
      setLoadingScript(false);
    }
  }

  async function refineNotes() {
    if (!customNotes.trim()) {
      setError("Paste or type your notes first.");
      return;
    }
    setError(null);
    await ensureOllamaStarted();
    setLoadingScript(true);
    try {
      const res = await apiPost<VideoScript & { reason?: string }>("/api/local-ai/refine-script", {
        raw_text: customNotes,
        business_profile: brandProfile || {},
        target_duration_sec: duration,
        model_name: selectedModel || undefined,
      });
      const reasonMsg = friendlyReason(res.reason);
      if (reasonMsg) setError(reasonMsg);
      onScriptReady(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not polish your notes.");
    } finally {
      setLoadingScript(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <SectionTitle
        step="Step 1 of 4"
        title="What do you want to make a video about?"
        subtitle="Type any topic. We research what's trending and write your script."
      />

      <ErrorBanner message={error} />

      <Panel className="p-6 mt-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && findIdeas()}
            placeholder="e.g. how founders save 10 hours a week with AI"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-slate-800 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <Button size="lg" onClick={findIdeas} loading={loadingIdeas}>
            Find ideas
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <span className="text-sm text-slate-500">Length:</span>
          {DURATIONS.map((d) => (
            <button
              key={d.sec}
              onClick={() => setDuration(d.sec)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                duration === d.sec
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {d.label}
            </button>
          ))}
          <div className="sm:ml-auto">
            <ModelPicker selectedModel={selectedModel} onModelChange={onModelChange} />
          </div>
        </div>

        {startingOllama && (
          <div className="flex items-center gap-2 text-sm text-slate-500 mt-3">
            <Spinner /> Starting Ollama…
          </div>
        )}

        {ideas.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-700">People are searching for:</p>
              {ideasRealtime === false && (
                <span className="text-xs text-amber-600">(offline suggestions)</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {ideas.slice(0, 8).map((q, i) => (
                <button
                  key={i}
                  onClick={() => {
                    onTopicChange(q.query);
                    generateScript(q.query);
                  }}
                  className="rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-2 text-sm hover:bg-indigo-100 transition text-left"
                >
                  {q.query}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Tap any suggestion to instantly write a script for it.
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Button
            variant="secondary"
            onClick={() => generateScript()}
            loading={loadingScript}
            className="flex-1"
          >
            ✍️ Write my script for “{topic.trim().slice(0, 40) || "my topic"}”
          </Button>
          <Button variant="ghost" onClick={() => setShowResearch(!showResearch)}>
            {showResearch ? "Hide" : "More"} research options
          </Button>
        </div>

        {showResearch && (
          <div className="mt-5 border-t border-slate-100 pt-5 space-y-5">
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">
                Learn from a YouTube channel
              </p>
              <div className="flex gap-2">
                <input
                  value={channelInput}
                  onChange={(e) => setChannelInput(e.target.value)}
                  placeholder="@channelname or channel link"
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Button variant="secondary" onClick={auditChannel} loading={loadingChannel}>
                  Analyze
                </Button>
              </div>
              {channelAudit && channelAudit.status !== "failed" && (
                <div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm">
                  <p className="font-semibold text-slate-700">
                    {channelAudit.channel_title} — top videos
                  </p>
                  <ul className="mt-2 space-y-1 text-slate-600">
                    {(channelAudit.videos || []).slice(0, 5).map((v, i) => (
                      <li key={i}>
                        • {v.title}
                        {v.view_count != null && (
                          <span className="text-slate-400">
                            {" "}
                            ({Intl.NumberFormat().format(v.view_count)} views)
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {(channelAudit.analysis?.viral_topic_opportunities || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {channelAudit
                        .analysis!.viral_topic_opportunities!.slice(0, 4)
                        .map((t, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              onTopicChange(t.topic);
                              generateScript(t.topic);
                            }}
                            className="rounded-full bg-white border border-slate-200 text-slate-700 px-3 py-1.5 text-xs hover:border-indigo-300 hover:text-indigo-700"
                          >
                            {t.topic}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">
                Have your own notes? We&apos;ll turn them into a script.
              </p>
              <textarea
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                rows={4}
                placeholder="Paste rough notes or a draft script here…"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <Button variant="secondary" size="sm" className="mt-2" onClick={refineNotes} loading={loadingScript}>
                Polish my notes
              </Button>
            </div>
          </div>
        )}
      </Panel>

      {script && (
        <Panel className="p-6 mt-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-bold text-slate-900">Your script</h3>
            <OfflineBadge show={isOfflineFallback(script)} />
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Read it as-is or tap any line to change the wording.
          </p>
          <ScriptEditor script={script} onChange={onScriptReady} />
          <Button
            size="lg"
            className="w-full mt-4"
            onClick={() => onScriptReady(script)}
          >
            Use this script → Record
          </Button>
        </Panel>
      )}
    </div>
  );
}

function ScriptEditor({
  script,
  onChange,
}: {
  script: VideoScript;
  onChange: (s: VideoScript) => void;
}) {
  function updateLine(idx: number, text: string) {
    const lines = script.body_lines.map((l, i) =>
      i === idx ? { ...l, spoken_text: text } : l
    );
    onChange({ ...script, body_lines: lines });
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
        <div className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-1">
          Hook — first 3 seconds
        </div>
        <input
          value={script.hook.spoken_text}
          onChange={(e) =>
            onChange({ ...script, hook: { ...script.hook, spoken_text: e.target.value } })
          }
          className="w-full bg-transparent text-slate-800 font-semibold text-lg focus:outline-none"
        />
      </div>

      {script.body_lines.map((line, idx) => (
        <div key={idx} className="rounded-xl bg-slate-50 border border-slate-100 p-4 flex gap-3 items-start">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white text-sm font-bold">
            {idx + 1}
          </span>
          <input
            value={line.spoken_text}
            onChange={(e) => updateLine(idx, e.target.value)}
            className="flex-1 bg-transparent text-slate-700 focus:outline-none"
          />
        </div>
      ))}

      <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
        <div className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-1">
          Ending — call to action
        </div>
        <input
          value={script.cta.spoken_text}
          onChange={(e) =>
            onChange({ ...script, cta: { ...script.cta, spoken_text: e.target.value } })
          }
          className="w-full bg-transparent text-slate-800 font-semibold focus:outline-none"
        />
      </div>
    </div>
  );
}
