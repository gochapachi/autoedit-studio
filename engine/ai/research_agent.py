import os
import re
import json
import logging
import urllib.parse
import requests
from typing import Dict, Any, List, Optional

logger = logging.getLogger("AutoEdit.ResearchAgent")

try:
    from ai.local_ai import DEFAULT_MODEL
except ImportError:
    try:
        from engine.ai.local_ai import DEFAULT_MODEL
    except ImportError:
        DEFAULT_MODEL = os.getenv("AUTOEDIT_OLLAMA_MODEL", "qwen2.5:3b")

class BusinessResearchAgent:
    """
    Agentic AI Business & Channel Researcher.
    Uses the local Ollama model (default qwen2.5:3b) combined with SearXNG / open web search
    and yt-dlp metadata scraping to deeply audit a business, target audience, competitors,
    and trending content pillars.
    """
    def __init__(self, ollama_url: str = "http://127.0.0.1:11434", default_model: str = DEFAULT_MODEL, searxng_url: str = "http://localhost:8080"):
        self.ollama_url = os.getenv("AUTOEDIT_OLLAMA_URL", ollama_url).rstrip('/')
        self.active_model = default_model or DEFAULT_MODEL
        self.searxng_url = searxng_url.rstrip('/')

    def clean_think_tags(self, text: str) -> str:
        """Strips <think>...</think> chain-of-thought tokens from Qwen/DeepSeek style models."""
        if not text:
            return ""
        cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
        return cleaned.strip()

    def search_web(self, query: str, num_results: int = 5) -> List[Dict[str, str]]:
        """
        Queries SearXNG if available, otherwise falls back to DuckDuckGo open search API.
        """
        results: List[Dict[str, str]] = []
        
        # 1. Try local SearXNG instance
        try:
            params = {
                "q": query,
                "format": "json",
                "categories": "general",
                "language": "en"
            }
            res = requests.get(f"{self.searxng_url}/search", params=params, timeout=3)
            if res.ok:
                data = res.json()
                for item in data.get("results", [])[:num_results]:
                    results.append({
                        "title": item.get("title", ""),
                        "url": item.get("url", ""),
                        "snippet": item.get("content", "")
                    })
                if results:
                    logger.info(f"SearXNG returned {len(results)} search results for: {query}")
                    return results
        except Exception as e:
            logger.debug(f"SearXNG local instance notice: {e}")

        # 2. Open Search fallback via DuckDuckGo Instant Answer / HTML endpoint
        try:
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            ddg_url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
            res = requests.get(ddg_url, headers=headers, timeout=4)
            if res.ok:
                # Extract snippets with regex
                snippets = re.findall(r'<a class="result__snippet[^>]*>(.*?)</a>', res.text, re.DOTALL)
                titles = re.findall(r'<a class="result__url[^>]*>(.*?)</a>', res.text, re.DOTALL)
                for i in range(min(num_results, len(snippets))):
                    clean_snip = re.sub(r'<[^>]+>', '', snippets[i]).strip()
                    clean_title = re.sub(r'<[^>]+>', '', titles[i]).strip() if i < len(titles) else query
                    if clean_snip:
                        results.append({
                            "title": clean_title,
                            "url": f"https://duckduckgo.com/?q={urllib.parse.quote(query)}",
                            "snippet": clean_snip
                        })
                if results:
                    return results
        except Exception as e:
            logger.debug(f"DuckDuckGo search notice: {e}")

        # 3. No web access: return empty rather than fabricating a fake source
        logger.info(f"No live web results available for: {query}")
        return []

    def scrape_youtube_channel_metadata(self, channel_url: str) -> Dict[str, Any]:
        """
        Scrapes public channel titles, descriptions, and top video patterns using yt-dlp.
        """
        if not channel_url or not channel_url.strip():
            return {"channel_title": "", "recent_videos": []}

        clean_url = channel_url.strip()
        videos = []
        channel_title = clean_url.split('/')[-1]

        try:
            import yt_dlp
            ydl_opts = {
                'extract_flat': 'in_playlist',
                'playlist_items': '1-8',
                'skip_download': True,
                'quiet': True,
                'no_warnings': True,
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(clean_url, download=False)
                if info:
                    channel_title = info.get('channel') or info.get('uploader') or info.get('title') or channel_title
                    entries = info.get('entries', [])
                    for entry in entries:
                        if entry and entry.get('title'):
                            videos.append({
                                "title": entry.get('title', ''),
                                "url": entry.get('url', ''),
                                "view_count": entry.get('view_count', 0)
                            })
        except Exception as e:
            logger.warning(f"yt-dlp channel extraction notice: {e}")

        return {
            "channel_title": channel_title,
            "channel_url": clean_url,
            "recent_videos": videos
        }

    def _call_ollama(self, prompt: str, system_prompt: Optional[str] = None) -> Optional[str]:
        """Calls Ollama with LisyNeko/qwen3.8-9b-coder and cleans think tags."""
        try:
            payload = {
                "model": self.active_model,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {
                    "temperature": 0.7,
                    "num_ctx": 8192
                }
            }
            if system_prompt:
                payload["system"] = system_prompt

            res = requests.post(f"{self.ollama_url}/api/generate", json=payload, timeout=45)
            if res.ok:
                raw_text = res.json().get("response", "")
                return self.clean_think_tags(raw_text)
        except Exception as e:
            logger.warning(f"Ollama call notice in ResearchAgent ({self.active_model}): {e}")
        return None

    def _extract_json(self, text: str) -> Optional[Dict[str, Any]]:
        """Extracts and parses JSON object from AI generation output."""
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
            logger.warning(f"JSON parsing error in ResearchAgent: {e}")
            return None

    def execute_agentic_research(self, business_name: str, niche: str, target_audience: str, youtube_url: str = "", goal: str = "") -> Dict[str, Any]:
        """
        Autonomous Agentic Research Workflow:
        1. Query web search for business background, niche trends, and competitors.
        2. Extract YouTube channel metadata and high-performing content patterns.
        3. Synthesize everything via LisyNeko/qwen3.8-9b-coder into a comprehensive Brand Intelligence Memory.
        """
        logger.info(f"Starting Agentic Business Research for: {business_name} ({niche})")

        # Step 1: Web Research
        search_queries = [
            f"{business_name} {niche} company product overview",
            f"top viral video trends {niche} 2026",
            f"biggest problems and questions {target_audience} {niche}"
        ]
        
        web_findings = []
        for q in search_queries:
            results = self.search_web(q, num_results=3)
            for r in results:
                web_findings.append(f"- {r['title']}: {r['snippet']}")

        web_context = "\n".join(web_findings[:8])

        # Step 2: YouTube Channel Audit
        yt_data = self.scrape_youtube_channel_metadata(youtube_url) if youtube_url else {"channel_title": "", "recent_videos": []}
        yt_videos_text = "\n".join([f"- {v['title']}" for v in yt_data.get('recent_videos', [])[:6]])

        # Step 3: LLM Agentic Synthesis
        system_prompt = (
            "You are an expert AI business strategist and viral video content director. "
            "Analyze the provided business details, web intelligence, and YouTube patterns. "
            "Synthesize an elite Brand Intelligence Profile in valid JSON only."
        )

        user_prompt = f"""
        Business Name: {business_name}
        Niche / Domain: {niche}
        Target Audience: {target_audience}
        Primary Goal: {goal or "Drive qualified leads and high video retention"}
        YouTube Channel: {youtube_url or "Not provided"}

        Web Search Intelligence:
        \"\"\"{web_context}\"\"\"

        Existing Channel Video Examples:
        \"\"\"{yt_videos_text or "No channel videos provided yet"}\"\"\"

        Return JSON strictly matching this structure:
        {{
            "brand_summary": "2-sentence executive summary of the business value proposition",
            "target_persona": {{
                "title": "Specific target customer profile",
                "core_pain_points": ["Pain point 1", "Pain point 2", "Pain point 3"],
                "desires": ["Desire 1", "Desire 2"]
            }},
            "content_pillars": [
                {{"pillar": "Pillar name", "description": "Why this works", "example_hook": "Hook sentence..."}},
                {{"pillar": "Pillar name", "description": "Why this works", "example_hook": "Hook sentence..."}},
                {{"pillar": "Pillar name", "description": "Why this works", "example_hook": "Hook sentence..."}}
            ],
            "viral_ideas": [
                {{
                    "topic": "Specific actionable video topic",
                    "format": "Screen Recording / Talking Head / POV",
                    "hook": "Spoken hook sentence",
                    "why_it_works": "High retention rationale"
                }},
                {{
                    "topic": "Specific actionable video topic 2",
                    "format": "Screen Recording / Talking Head / POV",
                    "hook": "Spoken hook sentence 2",
                    "why_it_works": "High retention rationale"
                }},
                {{
                    "topic": "Specific actionable video topic 3",
                    "format": "Screen Recording / Talking Head / POV",
                    "hook": "Spoken hook sentence 3",
                    "why_it_works": "High retention rationale"
                }}
            ],
            "recommended_voice": "Energetic, High-Authority & Direct",
            "cta_strategy": "Comment 'ACTION' for free workflow breakdown / Link in bio"
        }}
        """

        raw_llm = self._call_ollama(user_prompt, system_prompt)
        parsed = self._extract_json(raw_llm) if raw_llm else None

        if parsed and "content_pillars" in parsed and "viral_ideas" in parsed:
            parsed["business_name"] = business_name
            parsed["niche"] = niche
            parsed["youtube_channel"] = youtube_url
            parsed["web_sources_count"] = len(web_findings)
            parsed["source"] = "ollama"
            parsed["is_fallback"] = False
            return parsed

        # Robust Deterministic Synthesis Fallback
        clean_biz = business_name or "Your Business"
        clean_niche = niche or "AI & Technology"
        clean_aud = target_audience or "Founders & Creators"

        return {
            "business_name": clean_biz,
            "niche": clean_niche,
            "youtube_channel": youtube_url,
            "web_sources_count": len(web_findings),
            "source": "offline-fallback",
            "is_fallback": True,
            "brand_summary": f"{clean_biz} empowers {clean_aud} with modern, automated solutions in {clean_niche}.",
            "target_persona": {
                "title": f"Busy {clean_aud} looking to scale {clean_niche}",
                "core_pain_points": [
                    f"Wasting hours on repetitive manual workflows in {clean_niche}",
                    "Low engagement and high drop-off on generic content",
                    "Struggling to articulate clear ROI and systems to clients"
                ],
                "desires": [
                    "Fast 1-click automated workflows",
                    "Predictable growth and high-converting video retention"
                ]
            },
            "content_pillars": [
                {
                    "pillar": "Contrarian Industry Fixes",
                    "description": f"Call out common expensive mistakes in {clean_niche} and show the modern fix.",
                    "example_hook": f"Stop doing {clean_niche} the old way — here is what actually scales in 2026."
                },
                {
                    "pillar": "3-Step Implementation Breakdowns",
                    "description": "Show exact actionable screen workflows with step-by-step clarity.",
                    "example_hook": f"Here are 3 tools that automate {clean_niche} in under 60 seconds."
                },
                {
                    "pillar": "Behind-the-Scenes Proof & Case Studies",
                    "description": "Demonstrate real metrics, transformation results, and customer workflows.",
                    "example_hook": f"How we helped a founder 10x their output in {clean_niche} without hiring a team."
                }
            ],
            "viral_ideas": [
                {
                    "topic": f"3 AI Tools That Automate {clean_niche}",
                    "format": "Screen Recording",
                    "hook": f"If you are still doing {clean_niche} manually, you are wasting 10 hours every single week.",
                    "why_it_works": "Curiosity gap + massive immediate time-saving benefit."
                },
                {
                    "topic": f"The #1 Mistake in {clean_niche} (And How to Fix It)",
                    "format": "Talking Head",
                    "hook": f"90% of people make this costly mistake in {clean_niche} without even realizing it.",
                    "why_it_works": "Fear of loss triggers instant swipe-pause."
                },
                {
                    "topic": f"Full System Walkthrough: Scale in 30 Seconds",
                    "format": "Screen Recording + PiP Camera",
                    "hook": f"Watch how fast you can scale {clean_niche} using this exact automated stack.",
                    "why_it_works": "Proof-driven visual demo with high completion rate."
                }
            ],
            "recommended_voice": "Energetic, High-Authority, and Direct",
            "cta_strategy": f"Comment 'SCALE' and follow for daily actionable systems!"
        }
