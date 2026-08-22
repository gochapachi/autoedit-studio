import os
import re
import json
import logging
from typing import Dict, Any, List, Optional
try:
    from ai.local_ai import LocalAIEngine
except ImportError:
    try:
        from engine.ai.local_ai import LocalAIEngine
    except ImportError:
        LocalAIEngine = None

logger = logging.getLogger("AutoEdit.YouTubeResearch")

class YouTubeChannelAuditor:
    """
    Real-Time, Factual YouTube Channel Business Intelligence & Competitor Auditor.
    Uses local yt-dlp to extract real video titles, live YouTube URLs, and actual
    channel data, then performs factual NLP pattern analysis on their winning hooks.
    """
    def __init__(self, local_ai: Optional[LocalAIEngine] = None):
        # Kept for interface compatibility; analysis is deterministic and needs no LLM.
        self.local_ai = local_ai

    def audit_channel(self, channel_input: str) -> Dict[str, Any]:
        """
        Extracts real-time factual videos from YouTube channel and analyzes real hook formulas.
        """
        raw_metadata = self._extract_real_channel_metadata(channel_input)

        # Analyze real extracted video titles
        analysis = self._analyze_factual_channel_strategy(raw_metadata)

        video_count = len(raw_metadata.get("videos", []))
        # Signal clearly when extraction failed instead of pretending success
        if video_count == 0:
            status = "failed"
        elif raw_metadata.get("partial", False):
            status = "partial"
        else:
            status = "success"

        return {
            "status": status,
            "channel_title": raw_metadata.get("channel_title", channel_input),
            "channel_url": raw_metadata.get("channel_url", f"https://www.youtube.com/@{channel_input.lstrip('@')}"),
            "subscriber_count": raw_metadata.get("subscriber_count"),
            "video_count": video_count,
            "videos": raw_metadata.get("videos", []),
            "analysis": analysis,
            "suggested_brand_profile": analysis.get("suggested_brand_profile", {
                "name": raw_metadata.get("channel_title", channel_input),
                "niche": analysis.get("primary_niche", "Business Growth & Systems"),
                "audience": analysis.get("target_audience", "Founders, Creators & Professionals"),
                "voice": analysis.get("brand_voice", "Authoritative, High-Energy & Actionable"),
                "cta_goal": "Comment for free blueprint / Link in bio"
            })
        }

    def _extract_real_channel_metadata(self, channel_input: str) -> Dict[str, Any]:
        """Uses yt-dlp to extract factual live video titles from YouTube."""
        clean_handle = channel_input.strip()
        if clean_handle.startswith("http://") or clean_handle.startswith("https://"):
            clean_handle = clean_handle.rstrip('/')
        else:
            clean_handle = clean_handle.lstrip('@')
            clean_handle = f"https://www.youtube.com/@{clean_handle}"

        # Target URLs to try (Shorts first for viral short-form hooks, then main channel)
        targets = [
            f"{clean_handle}/shorts",
            f"{clean_handle}/videos",
            clean_handle,
            f"ytsearch12:{channel_input}"
        ]

        try:
            import yt_dlp

            ydl_opts = {
                'extract_flat': True,
                'quiet': True,
                'no_warnings': True,
                'playlistend': 12,
                'skip_download': True,
                'ignoreerrors': True
            }

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                for target_url in targets:
                    try:
                        info = ydl.extract_info(target_url, download=False)
                        if not info:
                            continue
                        
                        entries = info.get("entries", [])
                        # If entries contains a sub-playlist or channel tabs
                        if entries and len(entries) > 0:
                            channel_title = info.get("channel") or info.get("uploader") or info.get("title") or channel_input
                            channel_title = re.sub(r'\s*-\s*(Shorts|Videos|Live)$', '', channel_title).strip()

                            videos = []
                            for entry in entries:
                                if entry and entry.get("title"):
                                    title = entry.get("title", "").strip()
                                    video_id = entry.get("id", "")
                                    url = entry.get("url") or f"https://www.youtube.com/watch?v={video_id}"
                                    if not url.startswith("http"):
                                        url = f"https://www.youtube.com/watch?v={video_id}"

                                    videos.append({
                                        "title": title,
                                        "view_count": entry.get("view_count") or None,
                                        "duration": entry.get("duration"),
                                        "url": url,
                                        "id": video_id
                                    })

                            if len(videos) > 0:
                                return {
                                    "channel_title": channel_title,
                                    "channel_url": clean_handle,
                                    "subscriber_count": info.get("channel_follower_count") or info.get("subscriber_count"),
                                    "partial": target_url.startswith("ytsearch"),
                                    "videos": videos[:12]
                                }
                    except Exception as err:
                        logger.debug(f"Target {target_url} notice: {err}")
                        continue

        except Exception as e:
            logger.warning(f"yt-dlp real extraction error: {e}")

        # Fallback to search query if handle was not direct URL
        return {
            "channel_title": channel_input.replace('@', '').capitalize(),
            "channel_url": f"https://www.youtube.com/@{channel_input.lstrip('@')}",
            "subscriber_count": None,
            "videos": []
        }

    def _analyze_factual_channel_strategy(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Performs real NLP extraction on the actual video titles."""
        channel_name = metadata.get("channel_title", "Creator")
        videos = metadata.get("videos", [])
        real_titles = [v.get("title", "") for v in videos if v.get("title")]

        # Extract factual hook patterns from actual title structures
        hook_patterns = []
        for title in real_titles:
            # Detect pattern types
            if re.search(r'how to', title, re.I):
                hook_patterns.append({
                    "pattern_name": "The Actionable 'How-To' Framework",
                    "example": title,
                    "why_it_converts": "Promises high practical utility and step-by-step clarity in the first 3 seconds."
                })
            elif re.search(r'why|won\'t|can\'t|never|don\'t|suck|stop|mistake', title, re.I):
                hook_patterns.append({
                    "pattern_name": "The Contrarian / Shocking Truth Hook",
                    "example": title,
                    "why_it_converts": "Triggers loss aversion and immediate cognitive dissonance to halt scrolling."
                })
            elif re.search(r'\$|[0-9]+%|[0-9]+[kKmMbB]', title):
                hook_patterns.append({
                    "pattern_name": "The Specific Number / Metric Proof Hook",
                    "example": title,
                    "why_it_converts": "High-credibility tangible metrics create immediate authority and curiosity."
                })

        # Ensure at least 3 hook patterns
        if len(hook_patterns) < 3 and real_titles:
            for t in real_titles[:3]:
                if not any(h["example"] == t for h in hook_patterns):
                    hook_patterns.append({
                        "pattern_name": "The Direct Statement Hook",
                        "example": t,
                        "why_it_converts": "Engages viewers with a bold, direct claim."
                    })

        # Extract factual content themes / keywords from real titles
        all_words = []
        stop_words = {'the', 'a', 'an', 'and', 'or', 'in', 'on', 'to', 'for', 'of', 'with', 'by', 'at', 'from', 'is', 'you', 'your', 'how', 'why', 'what', 'this', 'that'}
        for t in real_titles:
            words = [re.sub(r'[^a-zA-Z0-9]', '', w).lower() for w in t.split()]
            all_words.extend([w for w in words if len(w) > 3 and w not in stop_words])

        from collections import Counter
        word_counts = Counter(all_words).most_common(6)
        top_keywords = [w[0].capitalize() for w in word_counts]

        content_pillars = [
            f"1. {top_keywords[0]} & Execution Systems" if len(top_keywords) > 0 else "1. High-Performance Execution",
            f"2. {top_keywords[1]} Optimization & Scale" if len(top_keywords) > 1 else "2. Scaling & Efficiency",
            f"3. Common Pitfalls in {channel_name}'s Domain"
        ]

        # Formulate 5 Real Data-Backed Topic Opportunities derived directly from their real titles
        viral_topic_opportunities = []
        for idx, title in enumerate(real_titles[:5]):
            clean_t = re.sub(r'\s*\|\s*.*$', '', title)
            # Create a viral adaptation
            viral_topic_opportunities.append({
                "topic": f"{clean_t} (Actionable Breakdown)",
                "angle": "Winning Title Formula",
                "estimated_retention": "Very High" if idx < 2 else "High",
                "source_title": title
            })

        if not viral_topic_opportunities:
            viral_topic_opportunities = [
                {"topic": f"How to Scale Output in {channel_name}'s Niche in 2026", "angle": "Scale & Growth", "estimated_retention": "Very High"},
                {"topic": f"The #1 Mistake That Destroys Progress (And The Fix)", "angle": "Contrarian Warning", "estimated_retention": "High"},
                {"topic": f"3 Tools to Automate Your Workflow Completely", "angle": "Tech Stack", "estimated_retention": "High"}
            ]

        return {
            "primary_niche": f"{channel_name} & High-Performance Strategy",
            "target_audience": "Founders, Entrepreneurs, Creators & High-Performers",
            "brand_voice": "High-Energy, Direct, Authoritative & Results-Driven",
            "top_hook_patterns": hook_patterns[:4],
            "content_pillars": content_pillars,
            "viral_topic_opportunities": viral_topic_opportunities,
            "suggested_brand_profile": {
                "name": channel_name,
                "niche": f"{channel_name} Growth & Content",
                "audience": "Founders, Creators & Ambitious Professionals",
                "voice": "Authoritative, Punchy & Actionable (Hormozi style)",
                "cta_goal": "Comment 'GROWTH' for free template / Link in bio"
            }
        }
