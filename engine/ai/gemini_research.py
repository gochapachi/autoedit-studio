import os
import json
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("AutoEdit.GeminiResearch")

class GeminiResearchEngine:
    """
    AI Content Strategist and Viral Script Generator powered by Gemini API.
    Handles business intake, keyword discovery, competitor analysis,
    retention-engineered 30-60s scripts, and social packaging.
    """
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY") or ""
        self.client = None
        if self.api_key:
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
                logger.info("Gemini API client initialized successfully.")
            except Exception as e:
                logger.warning(f"Could not initialize Google GenAI SDK: {e}. Will use direct fallback if needed.")

    def set_api_key(self, api_key: str):
        self.api_key = api_key
        try:
            from google import genai
            self.client = genai.Client(api_key=self.api_key)
            return True
        except Exception as e:
            logger.error(f"Failed to set Gemini API key: {e}")
            return False

    def _call_gemini(self, prompt: str, system_instruction: Optional[str] = None) -> str:
        """Helper to invoke Gemini with structured system instructions."""
        if not self.client:
            if not self.api_key:
                # Return rich mock simulation data if API key is not configured yet
                logger.warning("No Gemini API key provided. Using built-in high-quality templates.")
                return ""
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.error(f"Failed to create client: {e}")
                return ""

        try:
            config = {}
            if system_instruction:
                config["system_instruction"] = system_instruction
            
            response = self.client.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt,
                config=config if config else None
            )
            return response.text or ""
        except Exception as e:
            logger.error(f"Error calling Gemini model: {e}")
            return ""

    def research_keywords_and_trends(self, niche: str, topic: str) -> Dict[str, Any]:
        """
        Scans search ranking trends and high-demand, low-competition keywords for YouTube Shorts/Reels.
        """
        system_prompt = (
            "You are a world-class YouTube Shorts & TikTok SEO and Trend Research Expert. "
            "Return valid JSON only with keys: 'trending_queries', 'keyword_opportunities', 'competitor_angles', 'viral_hooks'."
        )
        user_prompt = f"""
        Analyze the niche '{niche}' with a focus on the topic '{topic}'.
        Identify:
        1. 5 High-Demand, Low-Competition search queries trending on YouTube Shorts & TikTok.
        2. 5 High-CTR Keyword tags.
        3. 3 Competitor hook angles that are dominating the algorithm right now.
        4. 3 Scroll-stopping 3-second hook ideas.

        Format strictly as JSON with this structure:
        {{
            "niche": "{niche}",
            "topic": "{topic}",
            "trending_queries": [
                {{"query": "string", "search_volume": "High|Very High", "competition": "Low|Medium", "intent": "How-to|Curiosity|Contrarian"}}
            ],
            "keyword_opportunities": ["tag1", "tag2", "tag3", "tag4", "tag5"],
            "competitor_angles": [
                {{"angle_title": "string", "why_it_works": "string", "suggested_twist": "string"}}
            ],
            "viral_hooks": ["Hook 1...", "Hook 2...", "Hook 3..."]
        }}
        """
        raw_text = self._call_gemini(user_prompt, system_prompt)
        if raw_text:
            try:
                cleaned = raw_text.strip().removeprefix("```json").removesuffix("```").strip()
                return json.loads(cleaned)
            except Exception as e:
                logger.error(f"JSON parse error for research: {e}")

        # Fallback intelligent template
        return {
            "niche": niche or "General Business",
            "topic": topic or "Fast Growth Strategies",
            "trending_queries": [
                {"query": f"How to scale {topic or niche} in 2026", "search_volume": "Very High", "competition": "Low", "intent": "How-to"},
                {"query": f"Biggest mistake in {niche} (Never do this)", "search_volume": "High", "competition": "Low", "intent": "Contrarian"},
                {"query": f"3 AI tools that automate {topic or niche}", "search_volume": "High", "competition": "Medium", "intent": "Curiosity"},
                {"query": f"{topic} tutorial for beginners", "search_volume": "High", "competition": "Low", "intent": "How-to"},
                {"query": f"Stop doing {topic} the hard way", "search_volume": "Very High", "competition": "Low", "intent": "Contrarian"}
            ],
            "keyword_opportunities": [f"#{niche.replace(' ', '').lower()}", f"#{topic.replace(' ', '').lower()}", "#viralshorts", "#contentcreator", "#businessgrowth"],
            "competitor_angles": [
                {"angle_title": "The Brutal Truth", "why_it_works": "Breaks common industry misconceptions, inducing high comment debate.", "suggested_twist": "Show proof of failure vs the quick fix."},
                {"angle_title": "The Step-by-Step 30s Framework", "why_it_works": "High save/share rate because viewers want actionable instructions.", "suggested_twist": "Use numbered visual step badges on screen."},
                {"angle_title": "The 'Hidden Secret' Reveal", "why_it_works": "High retention curiosity gap in the first 3 seconds.", "suggested_twist": "Start with a physical gesture or screenshot preview."}
            ],
            "viral_hooks": [
                f"If you're still doing {topic} like this, you are losing money every single day.",
                f"Here are the top 3 secrets about {niche} that experts will never tell you for free.",
                f"I tested 10 different ways to solve {topic}, and only this ONE method actually worked."
            ]
        }

    def generate_viral_script(self, topic: str, business_profile: Dict[str, Any], target_duration_sec: int = 45) -> Dict[str, Any]:
        """
        Generates a high-retention Short/Reel script structured with:
        - 0-3s Scroll-Stopping Hook
        - 3-45s Body with Visual / Sound Effect Cues
        - 45-60s High-Converting CTA
        """
        b_name = business_profile.get("name", "My Brand")
        b_niche = business_profile.get("niche", "General Business")
        b_audience = business_profile.get("audience", "Content Creators & Entrepreneurs")
        b_voice = business_profile.get("voice", "Energetic, High Authority & Actionable")
        b_cta_goal = business_profile.get("cta_goal", "Comment 'SCALE' for free template / Link in bio")

        system_prompt = (
            "You are an elite short-form video director (specializing in Hormozi/MrBeast style viral pacing). "
            "Write punchy, word-economical scripts for 9:16 Shorts/Reels with exact visual actions, sound effects, and timing. "
            "Output strictly valid JSON with keys: 'title', 'hook', 'body_lines', 'cta', 'estimated_seconds', 'visual_theme'."
        )

        user_prompt = f"""
        Create a high-retention viral script for a {target_duration_sec}-second Short/Reel.
        Business Context:
        - Business: {b_name}
        - Niche: {b_niche}
        - Audience: {b_audience}
        - Brand Tone: {b_voice}
        - CTA Goal: {b_cta_goal}
        - Topic: {topic}

        Format strictly as JSON:
        {{
            "title": "Short title",
            "visual_theme": "Fast-Paced Neon | Clean Minimalist | Tech Screen | Luxury Story",
            "estimated_seconds": {target_duration_sec},
            "hook": {{
                "spoken_text": "Spoken hook sentence (under 12 words)",
                "visual_action": "Action instruction like [Point to camera with shocked expression]",
                "overlay_text": "TOP BANNER HOOK TEXT (All Caps, Emoji)",
                "sfx": "whoosh | riser | boom"
            }},
            "body_lines": [
                {{
                    "line_id": 1,
                    "spoken_text": "Spoken sentence...",
                    "visual_action": "Instruction like [Show phone screen with graph]",
                    "emoji_highlight": "🚀",
                    "sfx": "pop | ding | click"
                }},
                {{
                    "line_id": 2,
                    "spoken_text": "Next spoken sentence...",
                    "visual_action": "Instruction like [Fast zoom cut to 1.2x]",
                    "emoji_highlight": "💡",
                    "sfx": "swoosh | ding"
                }},
                {{
                    "line_id": 3,
                    "spoken_text": "Third punchy sentence...",
                    "visual_action": "Instruction like [B-roll overlay of workspace]",
                    "emoji_highlight": "🔥",
                    "sfx": "cash_register | pop"
                }}
            ],
            "cta": {{
                "spoken_text": "Spoken CTA sentence...",
                "visual_action": "[Animated Follow / Link in Bio badge pops up]",
                "sfx": "ding"
            }}
        }}
        """
        raw_text = self._call_gemini(user_prompt, system_prompt)
        if raw_text:
            try:
                cleaned = raw_text.strip().removeprefix("```json").removesuffix("```").strip()
                return json.loads(cleaned)
            except Exception as e:
                logger.error(f"JSON parse error for script: {e}")

        # Intelligent Fallback Template
        return {
            "title": f"The Ultimate {topic} Secret",
            "visual_theme": "Fast-Paced Neon",
            "estimated_seconds": target_duration_sec,
            "hook": {
                "spoken_text": f"Stop scrolling if you want to master {topic} in less than 30 seconds.",
                "visual_action": "[Lean in close to camera with serious intensity]",
                "overlay_text": f"HOW TO 10X {topic.upper()} 🤯",
                "sfx": "riser"
            },
            "body_lines": [
                {
                    "line_id": 1,
                    "spoken_text": f"Number one: 90% of people in {b_niche} overcomplicate the first step.",
                    "visual_action": "[Show 1 finger up + 1.15x camera punch-in]",
                    "emoji_highlight": "⚠️",
                    "sfx": "pop"
                },
                {
                    "line_id": 2,
                    "spoken_text": "Instead, automate your repetitive tasks so you can focus entirely on high-leverage growth.",
                    "visual_action": "[Quick B-roll overlay of automated workflow]",
                    "emoji_highlight": "🚀",
                    "sfx": "whoosh"
                },
                {
                    "line_id": 3,
                    "spoken_text": "When we implemented this simple system, our overall output tripled in just one week.",
                    "visual_action": "[Show growth metric chart on screen]",
                    "emoji_highlight": "📈",
                    "sfx": "ding"
                }
            ],
            "cta": {
                "spoken_text": f"Drop a comment with '{b_cta_goal.split()[0]}' and follow for daily actionable strategies!",
                "visual_action": "[Animated Follow button + glowing underline appears]",
                "sfx": "bell_chime"
            }
        }

    def generate_social_package(self, script_text: str, business_name: str = "") -> Dict[str, Any]:
        """
        Generates 3 viral titles, SEO description with chapters, and hashtags.
        """
        system_prompt = (
            "You are a social media copywriter for viral Shorts/Reels/TikToks. "
            "Output strictly valid JSON with keys: 'viral_titles', 'seo_description', 'chapters', 'hashtags'."
        )
        user_prompt = f"""
        Based on this video script/transcript:
        \"\"\"{script_text}\"\"\"

        Generate:
        1. 3 High-CTR Clickable Titles for YouTube Shorts / Reels.
        2. 1 SEO-optimized Video Description.
        3. Timestamp chapter outline (e.g. 0:00 Hook, 0:08 The Mistake, 0:24 The Solution, 0:42 Action Step).
        4. 15 Highly targeted viral hashtags.

        Format strictly as JSON:
        {{
            "viral_titles": ["Title 1", "Title 2", "Title 3"],
            "seo_description": "Description...",
            "chapters": [
                {{"time": "0:00", "title": "The Big Reveal"}},
                {{"time": "0:08", "title": "The Step-by-Step Fix"}},
                {{"time": "0:35", "title": "Next Steps"}}
            ],
            "hashtags": ["#shorts", "#reels", "#trending"]
        }}
        """
        raw_text = self._call_gemini(user_prompt, system_prompt)
        if raw_text:
            try:
                cleaned = raw_text.strip().removeprefix("```json").removesuffix("```").strip()
                return json.loads(cleaned)
            except Exception as e:
                logger.error(f"JSON parse error for social package: {e}")

        return {
            "viral_titles": [
                "The #1 Secret Nobody Tells You 🤯",
                "How I Fixed This in 30 Seconds (Step-by-Step)",
                "Never Make This Mistake Again ❌"
            ],
            "seo_description": f"In this video, discover the exact step-by-step framework to maximize your results. Like and subscribe for more daily breakdowns!\n\nBrand: {business_name}",
            "chapters": [
                {"time": "0:00", "title": "Hook & The Problem"},
                {"time": "0:07", "title": "The 3-Step Solution"},
                {"time": "0:32", "title": "Actionable Takeaway"}
            ],
            "hashtags": ["#shorts", "#reels", "#tiktok", "#creator", "#viral", "#growth", "#aitools", "#strategy", "#entrepreneur", "#business"]
        }
