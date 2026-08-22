import os
import re
import json
import time
import logging
import requests
from typing import Dict, Any, List, Optional

logger = logging.getLogger("AutoEdit.LocalAI")

# Single source of truth for the default local model.
# qwen2.5:3b (~2GB q4) fits the <4GB VRAM budget; override with AUTOEDIT_OLLAMA_MODEL.
DEFAULT_MODEL = os.getenv("AUTOEDIT_OLLAMA_MODEL", "qwen2.5:3b")

class LocalAIEngine:
    """
    100% Local AI Content Strategist, Script Doctor, and Viral Video Director.
    Operates on-device using local Ollama (default model: qwen2.5:3b, fits <4GB VRAM)
    and an ultra-fast built-in deterministic offline viral heuristics engine (Zero Cloud).
    """
    def __init__(self, ollama_url: str = "http://127.0.0.1:11434", default_model: str = DEFAULT_MODEL):
        self.ollama_url = os.getenv("AUTOEDIT_OLLAMA_URL", ollama_url).rstrip('/')
        self.default_model = default_model or DEFAULT_MODEL
        self.active_model = self.default_model
        self._cached_models: List[str] = []
        self._last_model_check: float = 0
        self._last_fail_reason: Optional[str] = None

    def set_model(self, model_name: str):
        self.active_model = model_name

    def list_models(self) -> List[Dict[str, Any]]:
        """Lists all local models available in Ollama."""
        try:
            res = requests.get(f"{self.ollama_url}/api/tags", timeout=2)
            if res.ok:
                models = res.json().get("models", [])
                self._cached_models = [m.get("name", "") for m in models]
                self._last_model_check = time.time()
                return models
        except Exception as e:
            logger.debug(f"Ollama not reachable: {e}")
        return []

    def clean_think_tags(self, text: str) -> str:
        """Strips <think>...</think> reasoning blocks from Qwen/DeepSeek style models."""
        if not text:
            return ""
        cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
        return cleaned.strip()

    def _is_model_installed(self, model_name: str) -> bool:
        """Checks if a model is installed without blocking for long."""
        if not model_name or model_name == "Built-in Offline Engine":
            return False

        # Refresh cache if older than 30s
        if time.time() - self._last_model_check > 30:
            self.list_models()

        clean_name = model_name.split(':')[0]
        for m in self._cached_models:
            installed_base = m.split(':')[0]
            # Exact full name, or same base model with a different tag
            if m == model_name or installed_base == clean_name:
                return True
        return False

    def pull_model(self, model_name: str) -> Dict[str, Any]:
        """Triggers local model pull in Ollama."""
        try:
            res = requests.post(f"{self.ollama_url}/api/pull", json={"name": model_name, "stream": False}, timeout=120)
            if res.ok:
                self.list_models()
                return {"status": "success", "message": f"Successfully pulled {model_name}"}
        except Exception as e:
            logger.error(f"Error pulling model {model_name}: {e}")
        return {"status": "error", "message": f"Failed to pull {model_name}"}

    def _ollama_reachable(self) -> bool:
        try:
            return requests.get(f"{self.ollama_url}/api/version", timeout=1.5).ok
        except Exception:
            return False

    def _consume_fail_reason(self) -> str:
        reason = self._last_fail_reason or "unknown"
        self._last_fail_reason = None
        return reason

    def _call_local_llm(self, prompt: str, system_prompt: Optional[str] = None, as_json: bool = True) -> Optional[str]:
        """Calls local Ollama API if model is available. Retries once on timeout/failure."""
        self._last_fail_reason = None
        # Auto-detect available model if active_model is not installed
        if not self._is_model_installed(self.active_model):
            available = self.list_models()
            if available:
                self.active_model = available[0].get("name", "")
                logger.info(f"Configured model unavailable; using first installed Ollama model: {self.active_model}")
            else:
                self._last_fail_reason = (
                    "no_models_installed" if self._ollama_reachable() else "ollama_not_running"
                )
                return None

        payload = {
            "model": self.active_model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.75,
                "num_ctx": 8192
            }
        }
        if as_json:
            payload["format"] = "json"
        if system_prompt:
            payload["system"] = system_prompt

        # Small local models on limited VRAM can be slow; allow generous time and 1 retry.
        for attempt in (1, 2):
            try:
                logger.info(f"Invoking Local LLM ({self.active_model}) for AI generation (attempt {attempt})...")
                res = requests.post(f"{self.ollama_url}/api/generate", json=payload, timeout=120)
                if res.ok:
                    data = res.json()
                    response_text = self.clean_think_tags(data.get("response", ""))
                    if response_text:
                        logger.info(f"Local LLM ({self.active_model}) generated {len(response_text)} chars successfully.")
                        return response_text
            except Exception as e:
                logger.warning(f"Local LLM call notice (attempt {attempt}): {e}.")
        logger.warning("Local LLM unavailable; using built-in offline heuristics.")
        self._last_fail_reason = "model_error"
        return None

    def _extract_json(self, text: str) -> Optional[Dict[str, Any]]:
        """Safely parses JSON from model output."""
        if not text:
            return None
        try:
            cleaned = self.clean_think_tags(text)
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned.strip(), flags=re.MULTILINE)
            cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE).strip()
            
            first_brace = cleaned.find("{")
            last_brace = cleaned.rfind("}")
            if first_brace != -1 and last_brace != -1:
                cleaned = cleaned[first_brace:last_brace + 1]
            
            return json.loads(cleaned)
        except Exception as e:
            logger.warning(f"Failed to parse JSON from local LLM: {e}")
            return None

    def chat_ideate_topics(
        self,
        user_message: str,
        business_profile: Optional[Dict[str, Any]] = None,
        current_script: Optional[Dict[str, Any]] = None,
        target_format: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Conversational AI Agent for topic brainstorming, angle selection, and real-time script modification.
        """
        if not business_profile:
            business_profile = {}

        b_niche = str(business_profile.get("niche") or "").strip() or "their field"
        b_voice = str(business_profile.get("voice") or "").strip() or "direct and energetic"

        msg_lower = user_message.lower()
        is_script_action = any(k in msg_lower for k in [
            "script", "hook", "step", "cta", "modify", "change", "rewrite", "shorten", 
            "longer", "punchier", "tone", "draft", "write", "teleprompter", "generate script"
        ]) or current_script is not None

        system_prompt = (
            f"You are the AI Executive Producer and short-form script director for a creator in {b_niche}. "
            "You help brainstorm video topics AND draft or modify retention-engineered 30s-60s scripts. "
            "Write every line originally — no template phrases. Always return strict JSON."
        )

        user_prompt = f"""
        User Request: "{user_message}"
        Tone of voice: {b_voice}
        Current Script (if any): {json.dumps(current_script) if current_script else "None"}

        Instructions:
        1. If the user is asking to brainstorm topics or angles, return "proposed_topics" (3 viral angles with formats).
        2. If the user is asking to draft a script, modify an existing script, refine a hook, change steps, or adjust tone, return "generated_script" with complete hook, body_lines, and cta objects.
        3. You can provide both "agent_reply" explaining the changes/vision and either "proposed_topics" or "generated_script" (or both).

        Format strictly as JSON:
        {{
            "agent_reply": "Direct, conversational 1-2 sentence response to the founder",
            "proposed_topics": [
                {{
                    "title": "Topic Angle Title",
                    "hook": "0-3s Hook text",
                    "format": "Screen Recording + PiP Camera / Talking Head POV / Screen Only",
                    "why_it_works": "Why this retains attention"
                }}
            ],
            "generated_script": {{
                "title": "Script Title",
                "estimated_seconds": 45,
                "recommended_format": "Screen Recording + PiP Camera",
                "hook": {{
                    "spoken_text": "Spoken hook line under 12 words",
                    "visual_action": "[Camera gesture cue]",
                    "overlay_text": "TOP BANNER TEXT 🤯",
                    "sfx": "riser"
                }},
                "body_lines": [
                    {{
                        "line_id": 1,
                        "spoken_text": "Step 1 spoken sentence",
                        "visual_action": "[Visual cue]",
                        "emoji_highlight": "🚀",
                        "sfx": "pop"
                    }},
                    {{
                        "line_id": 2,
                        "spoken_text": "Step 2 spoken sentence",
                        "visual_action": "[Visual cue]",
                        "emoji_highlight": "⚡",
                        "sfx": "whoosh"
                    }},
                    {{
                        "line_id": 3,
                        "spoken_text": "Step 3 spoken sentence",
                        "visual_action": "[Visual cue]",
                        "emoji_highlight": "📈",
                        "sfx": "ding"
                    }}
                ],
                "cta": {{
                    "spoken_text": "Spoken CTA sentence",
                    "visual_action": "[Point down to comment/link]",
                    "sfx": "bell_chime"
                }}
            }}
        }}
        """

        raw = self._call_local_llm(user_prompt, system_prompt)
        parsed = self._extract_json(raw) if raw else None
        if parsed:
            # Check if valid script or topics present
            if "generated_script" in parsed and parsed["generated_script"] and "hook" in parsed["generated_script"]:
                parsed["source"] = "ollama"
                return parsed
            if "proposed_topics" in parsed and len(parsed["proposed_topics"]) > 0:
                parsed["source"] = "ollama"
                return parsed

        # Intelligent Fallback
        clean_input = user_message.replace("I want to make a video on", "").replace("make a video about", "").strip()
        if not clean_input:
            clean_input = user_message.strip()[:60] or "your topic"

        fallback_script = self.generate_viral_script(clean_input, business_profile, target_duration_sec=45)

        return {
            "source": "offline-fallback",
            "reason": self._consume_fail_reason(),
            "agent_reply": f"Here's a starting script for '{clean_input}'. For AI-written quality, install a model from the model picker.",
            "proposed_topics": [
                {
                    "title": f"The fastest way to understand {clean_input}",
                    "hook": f"Most explanations of {clean_input} miss the one part that matters.",
                    "format": "Talking head",
                    "why_it_works": "Curiosity gap around a familiar topic."
                },
                {
                    "title": f"What people get wrong about {clean_input}",
                    "hook": f"Almost everyone gets {clean_input} wrong in the same way.",
                    "format": "Talking head",
                    "why_it_works": "Contrarian angle invites comments."
                },
                {
                    "title": f"{clean_input}, explained in under a minute",
                    "hook": f"Here is {clean_input} without the jargon.",
                    "format": "Screen + camera",
                    "why_it_works": "Clear promise, high save rate."
                }
            ],
            "generated_script": fallback_script
        }

    # ------------------ 1. LOCAL KEYWORD & TREND RESEARCH ------------------ #

    def research_keywords_and_trends(self, niche: str, topic: str) -> Dict[str, Any]:
        """
        100% Local SEO trend analysis and viral hook generation for YouTube Shorts & TikTok.
        """
        niche = niche.strip() if niche else "AI Automation & Business Growth"
        topic = topic.strip() if topic else "Scale Fast in 2026"

        system_prompt = (
            "You are a local viral video strategist for YouTube Shorts and TikTok. "
            "Output valid JSON only with keys: 'trending_queries', 'keyword_opportunities', 'competitor_angles', 'viral_hooks'."
        )
        user_prompt = f"""
        Analyze niche '{niche}' and topic '{topic}'.
        Return JSON strictly:
        {{
            "niche": "{niche}",
            "topic": "{topic}",
            "trending_queries": [
                {{"query": "...", "search_volume": "High|Very High", "competition": "Low|Medium", "intent": "How-to|Contrarian|Curiosity"}}
            ],
            "keyword_opportunities": ["tag1", "tag2", "tag3", "tag4", "tag5"],
            "competitor_angles": [
                {{"angle_title": "...", "why_it_works": "...", "suggested_twist": "..."}}
            ],
            "viral_hooks": ["Hook 1...", "Hook 2...", "Hook 3..."]
        }}
        """

        raw_output = self._call_local_llm(user_prompt, system_prompt)
        parsed = self._extract_json(raw_output) if raw_output else None
        if parsed and "trending_queries" in parsed and len(parsed["trending_queries"]) > 0:
            parsed["source"] = "ollama"
            return parsed

        # High-Quality Deterministic Local Intelligence Engine
        clean_tag = re.sub(r'[^a-zA-Z0-9]', '', niche).lower()[:15] or "growth"
        topic_tag = re.sub(r'[^a-zA-Z0-9]', '', topic).lower()[:15] or "video"

        return {
            "niche": niche,
            "topic": topic,
            "source": "offline-fallback",
            "trending_queries": [
                {"query": f"How to master {topic} in 2026", "search_volume": "Very High", "competition": "Low", "intent": "How-to"},
                {"query": f"The biggest mistake in {niche} (Never do this)", "search_volume": "High", "competition": "Low", "intent": "Contrarian"},
                {"query": f"3 tools that automate {topic} completely", "search_volume": "Very High", "competition": "Low", "intent": "Curiosity"},
                {"query": f"Why 90% of people fail at {topic} (And the fix)", "search_volume": "High", "competition": "Medium", "intent": "How-to"},
                {"query": f"Stop doing {topic} the hard way", "search_volume": "Very High", "competition": "Low", "intent": "Contrarian"}
            ],
            "keyword_opportunities": [f"#{clean_tag}", f"#{topic_tag}", "#viralshorts", "#founder", "#automation", "#scale2026", "#growthhacks"],
            "competitor_angles": [
                {"angle_title": "The Brutal Truth", "why_it_works": "Disproves common misconceptions, provoking high comment debate.", "suggested_twist": "Contrast a failed manual workflow with the 1-click automated fix."},
                {"angle_title": "The 3-Step Framework", "why_it_works": "High save and share rate because viewers want actionable instructions.", "suggested_twist": "Show numbered step badges with exact camera punch zooms."},
                {"angle_title": "The 'Hidden Secret' Reveal", "why_it_works": "High retention curiosity gap in the first 3 seconds.", "suggested_twist": "Start with a direct lean-in camera gesture and proof metric."}
            ],
            "viral_hooks": [
                f"If you are still doing {topic} manually, you are wasting 10 hours every single week.",
                f"Here are the top 3 secrets about {niche} that top founders never share for free.",
                f"I tested every method for {topic}, and only this ONE framework actually worked."
            ]
        }

    # ------------------ 2. LOCAL VIRAL SCRIPT GENERATION ------------------ #

    def generate_viral_script(self, topic: str, business_profile: Optional[Dict[str, Any]] = None, target_duration_sec: int = 45) -> Dict[str, Any]:
        """
        100% Local retention-engineered script generation. Every spoken line is
        written by the local model — no template phrases or canned CTAs.
        """
        if not business_profile:
            business_profile = {}

        clean_topic = topic.strip() if topic else "an interesting topic"

        # Brand context is included ONLY when the user actually filled it in —
        # never inject demo marketing copy.
        brand_lines = []
        for key, label in (("name", "Business name"), ("niche", "Niche"), ("audience", "Target audience"), ("voice", "Tone of voice")):
            val = str(business_profile.get(key) or "").strip()
            if val:
                brand_lines.append(f"{label}: {val}")
        cta_goal = str(business_profile.get("cta_goal") or "").strip()
        if cta_goal:
            brand_lines.append(f"Desired call to action: {cta_goal}")
        brand_context = "\n".join(brand_lines) if brand_lines else "No brand context provided — write for the topic alone."

        system_prompt = (
            "You are an elite short-form video scriptwriter. You write high-retention "
            "vertical video scripts where EVERY sentence is original, specific to the "
            "topic, and written by you from scratch. Output valid JSON only."
        )
        user_prompt = f"""
        Write a {target_duration_sec}-second vertical video script about:
        "{clean_topic}"

        {brand_context}

        Rules:
        - Write all spoken lines yourself. Never use filler scaffolding like "Step one:", "Step two:", or any placeholder phrasing.
        - The hook must stop the scroll in one sentence (max 12 words), specific to this topic.
        - Body lines flow naturally (3-5 lines for {target_duration_sec}s) — each adds new, concrete information about the topic.
        - The closing line is a natural call to action you write for THIS topic (only follow the desired CTA above if one was provided).
        - visual_action is a short camera/scene direction; overlay_text is short ALL-CAPS on-screen text; sfx is one word; emoji_highlight is one emoji.

        Format strictly as JSON:
        {{
            "title": "<your title for this script>",
            "estimated_seconds": {target_duration_sec},
            "hook": {{
                "spoken_text": "<your original opening line>",
                "visual_action": "<camera/scene direction>",
                "overlay_text": "<short ALL-CAPS on-screen text>",
                "sfx": "<one word>"
            }},
            "body_lines": [
                {{
                    "line_id": 1,
                    "spoken_text": "<your next original line>",
                    "visual_action": "<camera/scene direction>",
                    "emoji_highlight": "<emoji>",
                    "sfx": "<one word>"
                }}
            ],
            "cta": {{
                "spoken_text": "<your original closing call to action>",
                "visual_action": "<camera/scene direction>",
                "sfx": "<one word>"
            }}
        }}
        """

        raw_output = self._call_local_llm(user_prompt, system_prompt)
        parsed = self._extract_json(raw_output) if raw_output else None
        if parsed and "hook" in parsed and "body_lines" in parsed and len(parsed["body_lines"]) > 0:
            parsed.setdefault("title", clean_topic)
            parsed["source"] = "ollama"
            return parsed

        # Offline last-resort scaffold (clearly badged in the UI). Kept minimal
        # and topic-derived — no canned marketing phrases.
        topic_lower = clean_topic.lower()
        key_phrase = re.sub(r'^(the|a|an|how to|top|\d+)\s+', '', topic_lower).strip() or topic_lower
        banner_slug = re.sub(r'[^a-zA-Z0-9\s]', '', clean_topic).upper()[:22]
        overlay_text = f"{banner_slug}!"

        return {
            "title": clean_topic,
            "source": "offline-fallback",
            "reason": self._consume_fail_reason(),
            "visual_theme": "Simple",
            "estimated_seconds": target_duration_sec,
            "hook": {
                "spoken_text": f"Here is what most people get wrong about {key_phrase}.",
                "visual_action": "[Look straight into the camera]",
                "overlay_text": overlay_text,
                "sfx": "none"
            },
            "body_lines": [
                {
                    "line_id": 1,
                    "spoken_text": f"The core problem with {key_phrase} is simpler than it looks.",
                    "visual_action": "[Gesture to the topic on screen]",
                    "emoji_highlight": "❗",
                    "sfx": "none"
                },
                {
                    "line_id": 2,
                    "spoken_text": f"Change one thing about how you approach {key_phrase} and the result compounds.",
                    "visual_action": "[Show the difference on screen]",
                    "emoji_highlight": "➡️",
                    "sfx": "none"
                },
                {
                    "line_id": 3,
                    "spoken_text": "That single adjustment is what separates the people who win here from everyone else.",
                    "visual_action": "[Lean in slightly]",
                    "emoji_highlight": "✅",
                    "sfx": "none"
                }
            ],
            "cta": {
                "spoken_text": f"Follow for more on {key_phrase}.",
                "visual_action": "[Point toward the follow button]",
                "sfx": "none"
            }
        }

    # ------------------ 3. LOCAL CUSTOM SCRIPT DOCTOR / REFINER ------------------ #

    def refine_custom_script(self, raw_text: str, business_profile: Optional[Dict[str, Any]] = None, target_duration_sec: int = 45) -> Dict[str, Any]:
        """
        100% Local AI Script Doctor & Refiner:
        Takes raw unstructured founder notes or talking points and transforms them into
        a viral 30-60s Short/Reel script with retention hooks, visual actions, emoji accents, and SFX cues.
        """
        if not business_profile:
            business_profile = {}

        clean_raw = raw_text.strip() if raw_text else ""

        brand_lines = []
        for key, label in (("name", "Business name"), ("niche", "Niche"), ("audience", "Target audience"), ("voice", "Tone of voice")):
            val = str(business_profile.get(key) or "").strip()
            if val:
                brand_lines.append(f"{label}: {val}")
        cta_goal = str(business_profile.get("cta_goal") or "").strip()
        if cta_goal:
            brand_lines.append(f"Desired call to action: {cta_goal}")
        brand_context = "\n".join(brand_lines) if brand_lines else "No brand context provided."

        system_prompt = (
            "You are an expert script doctor for vertical short videos. You rewrite the user's "
            "own notes into a polished, high-retention script — keeping THEIR meaning and facts, "
            "improving flow and punch. Output valid JSON only."
        )
        user_prompt = f"""
        User's raw draft / talking points:
        \"\"\"{clean_raw}\"\"\"

        {brand_context}
        Target duration: {target_duration_sec}s

        Rules:
        - Preserve the author's actual content — restructure and tighten, never invent different claims.
        - Write every spoken line yourself in natural language; no scaffolding like "Step one:" or placeholder text.
        - The hook is the strongest single sentence from their material (max 12 words).
        - The closing line is a call to action you write for THIS script (follow the desired CTA only if provided above).

        Return JSON strictly:
        {{
            "title": "<your title from their draft>",
            "estimated_seconds": {target_duration_sec},
            "hook": {{
                "spoken_text": "<their strongest opening, tightened>",
                "visual_action": "<camera/scene direction>",
                "overlay_text": "<short ALL-CAPS on-screen text>",
                "sfx": "<one word>"
            }},
            "body_lines": [
                {{
                    "line_id": 1,
                    "spoken_text": "<their point, tightened into one line>",
                    "visual_action": "<camera/scene direction>",
                    "emoji_highlight": "<emoji>",
                    "sfx": "<one word>"
                }}
            ],
            "cta": {{
                "spoken_text": "<your closing call to action>",
                "visual_action": "<camera/scene direction>",
                "sfx": "<one word>"
            }}
        }}
        """

        raw_output = self._call_local_llm(user_prompt, system_prompt)
        parsed = self._extract_json(raw_output) if raw_output else None
        if parsed and "hook" in parsed and "body_lines" in parsed and len(parsed["body_lines"]) > 0:
            parsed["raw_input"] = clean_raw
            parsed["source"] = "ollama"
            return parsed

        # Intelligent Local Heuristic Parser for Raw Custom Text
        lines = [l.strip() for l in clean_raw.split('\n') if l.strip()]
        if not lines:
            lines = [l.strip() for l in re.split(r'[\.\?\!]', clean_raw) if len(l.strip()) > 8]
        if not lines:
            lines = [clean_raw]

        first_sentence = lines[0]
        # Clean first sentence for hook
        first_sentence = re.sub(r'^[0-9\.\-\*\#\s]+', '', first_sentence).strip()
        if len(first_sentence) > 85:
            first_sentence = first_sentence[:80] + "..."

        spoken_hook = first_sentence

        hook_slug = re.sub(r'[^a-zA-Z0-9\s]', '', first_sentence).upper()[:22]
        banner_text = f"{hook_slug}!"

        sfx_list = ["pop", "whoosh", "ding", "click", "swoosh"]
        emojis = ["💡", "🚀", "🔥", "⚡", "📈", "🎯", "💰", "⚙️"]
        visual_actions = [
            "[Show 1 finger up + 1.15x camera punch-in]",
            "[Quick screen glance + visual diagram overlay]",
            "[Lean back slightly + emphatic hand gesture]",
            "[Fast cut to 1.25x closeup]",
            "[Show metric graph on screen]"
        ]

        body_lines = []
        raw_body_items = lines[1:] if len(lines) > 1 else [l.strip() for l in re.split(r'[\.\?\!]', clean_raw) if len(l.strip()) > 10]
        if not raw_body_items:
            raw_body_items = ["Here is the exact step-by-step workflow you need to know."]

        for idx, item in enumerate(raw_body_items[:4]):
            clean_item = re.sub(r'^[0-9\.\-\*\#\s]+', '', item).strip()
            if not clean_item:
                continue
            body_lines.append({
                "line_id": idx + 1,
                "spoken_text": clean_item,
                "visual_action": visual_actions[idx % len(visual_actions)],
                "emoji_highlight": emojis[idx % len(emojis)],
                "sfx": sfx_list[idx % len(sfx_list)]
            })


        return {
            "title": first_sentence[:40] or "Custom Refined Script",
            "source": "offline-fallback",
            "reason": self._consume_fail_reason(),
            "visual_theme": "Simple",
            "estimated_seconds": target_duration_sec,
            "raw_input": clean_raw,
            "hook": {
                "spoken_text": spoken_hook,
                "visual_action": "[Look straight into the camera]",
                "overlay_text": banner_text,
                "sfx": "none"
            },
            "body_lines": body_lines if body_lines else [
                {
                    "line_id": 1,
                    "spoken_text": first_sentence,
                    "visual_action": "[Gesture to the topic on screen]",
                    "emoji_highlight": "❗",
                    "sfx": "none"
                }
            ],
            "cta": {
                "spoken_text": "Follow for more breakdowns like this one.",
                "visual_action": "[Point toward the follow button]",
                "sfx": "none"
            }
        }

    def correct_transcript_words(self, words: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        AI-corrects a word-level transcript: fixes misheard words, spelling and
        capitalisation while keeping the exact word count and timings intact so
        the edited words can drop straight back into the caption pipeline.
        """
        if not words:
            return {"status": "error", "error": "No words provided.", "source": "ollama"}

        tokens = [str(w.get("word", "")) for w in words]

        system_prompt = (
            "You are a meticulous transcription proofreader. You correct misheard words, "
            "spelling, and capitalisation of a video transcript. Output valid JSON only."
        )
        user_prompt = f"""
        Below is a transcript from an automatic speech recognizer, one word per entry.
        Fix misrecognitions, spelling, and capitalisation so the text reads exactly as
        the speaker intended. Keep the SAME number of entries (one output word per input
        word — never merge, split, add, or drop entries). Proper nouns, product names and
        domain terms must be spelled correctly. Return ONLY a JSON array of strings.

        Input words:
        {json.dumps(tokens, ensure_ascii=False)}
        """

        raw = self._call_local_llm(user_prompt, system_prompt)
        parsed = None
        if raw:
            try:
                candidate = json.loads(raw)
                if isinstance(candidate, str):
                    candidate = json.loads(candidate)
                if isinstance(candidate, list) and len(candidate) == len(tokens):
                    parsed = [str(t) for t in candidate]
            except Exception:
                parsed = None

        if parsed is None:
            # Try to salvage a wrong-length array by best-effort alignment
            if isinstance(parsed, list):
                logger.warning(f"Transcript fix returned {len(parsed)} words for {len(tokens)} inputs.")
            return {
                "status": "error",
                "error": "The AI could not reliably fix this transcript. Edit the words manually instead.",
                "reason": self._consume_fail_reason(),
                "source": "offline-fallback",
                "words": words,
            }

        corrected = [
            {**w, "word": fixed or orig}
            for w, fixed, orig in zip(words, parsed, tokens)
        ]
        return {"status": "success", "source": "ollama", "words": corrected}

    # ------------------ 4. LOCAL SOCIAL PACKAGING ------------------ #

    def generate_social_package(self, script_text: str, business_name: str = "") -> Dict[str, Any]:
        """
        Generates 3 viral titles, SEO description, chapter timestamps, and hashtags locally.
        """
        system_prompt = (
            "You are a viral social media copywriter for Shorts, Reels, and TikTok. "
            "Output valid JSON only with keys: 'viral_titles', 'seo_description', 'chapters', 'hashtags'."
        )
        user_prompt = f"""
        Video Script / Transcript:
        \"\"\"{script_text}\"\"\"
        Business: {business_name}

        Generate JSON strictly:
        {{
            "viral_titles": ["Title 1", "Title 2", "Title 3"],
            "seo_description": "Description...",
            "chapters": [
                {{"time": "0:00", "title": "Hook"}},
                {{"time": "0:08", "title": "Step 1"}},
                {{"time": "0:30", "title": "CTA"}}
            ],
            "hashtags": ["#shorts", "#reels", "#trending"]
        }}
        """

        raw_output = self._call_local_llm(user_prompt, system_prompt)
        parsed = self._extract_json(raw_output) if raw_output else None
        if parsed and "viral_titles" in parsed:
            parsed["source"] = "ollama"
            return parsed

        # Offline fallback: derive titles from the first line of the actual script
        # text instead of returning generic constants.
        first_line = next((l.strip() for l in (script_text or "").splitlines() if l.strip()), "")
        core = re.sub(r'^[\W\d]+', '', first_line).strip().rstrip('.!') or "This Video"
        if len(core) > 60:
            core = core[:57] + "..."

        return {
            "source": "offline-fallback",
            "reason": self._consume_fail_reason(),
            "viral_titles": [
                core[:80],
                f"{core[:55]} — what nobody tells you",
                f"The honest take on {core[:50]}"
            ],
            "seo_description": f"{first_line}\n\nSubscribe for more videos like this." + (f"\nBrand: {business_name}" if business_name else ""),
            "chapters": [
                {"time": "0:00", "title": "Opening"},
                {"time": "0:08", "title": "Main points"},
                {"time": "0:32", "title": "Closing"}
            ],
            "hashtags": ["#shorts", "#reels", "#tiktok"]
        }
