import os
import re
import json
import logging
import requests
from typing import Dict, Any, List, Optional

logger = logging.getLogger("AutoEdit.SEORadar")

class RealtimeSEORadar:
    """
    100% Real-Time, Factual YouTube SEO Trend Radar & Competitor Intelligence.
    Fetches live YouTube search autocompletions and real ranking competitor videos
    via yt-dlp flat extraction and YouTube Suggest APIs.
    """
    def __init__(self):
        pass

    def fetch_live_seo_radar(self, niche: str, topic: str) -> Dict[str, Any]:
        """
        Executes real-time factual research:
        1. Live YouTube search autocompletions for topic and niche
        2. Real ranking competitor videos on YouTube with view counts & channels
        3. Real High-CTR keyword tags extracted from ranking titles
        4. Factual competitor hook angles
        """
        clean_topic = topic.strip() if topic else "ai video editing"
        clean_niche = niche.strip() if niche else "content creation"

        # 1. Fetch Real-time YouTube Autocomplete Suggestions
        suggestions = self._fetch_live_youtube_suggestions(clean_topic, clean_niche)
        suggest_ok = bool(suggestions)
        # Offline fallback queries are clearly labeled, not passed off as live
        live_queries = suggestions if suggest_ok else self._offline_query_fallback(clean_topic)

        # 2. Fetch Real Ranking Competitor Videos via yt-dlp
        competitor_videos = self._fetch_live_competitor_videos(clean_topic)

        # 3. Extract factual keyword tags & hook angles from real ranking titles
        extracted_tags, competitor_angles = self._analyze_ranking_videos(competitor_videos, clean_topic, clean_niche)

        # 4. Generate high-converting hooks based on real live queries
        viral_hooks = [
            f"If you are still searching '{live_queries[0]['query'] if live_queries else clean_topic}', stop and watch this.",
            f"Here is why 90% of creators fail with {clean_topic} in 2026 (And the 1-click fix).",
            f"I tested every method for {clean_topic}, and only this ONE automated workflow actually worked."
        ]

        return {
            "niche": clean_niche,
            "topic": clean_topic,
            "is_realtime": suggest_ok or bool(competitor_videos),
            "trending_queries": live_queries[:6],
            "competitor_videos": competitor_videos[:8],
            "keyword_opportunities": extracted_tags[:8],
            "competitor_angles": competitor_angles[:3],
            "viral_hooks": viral_hooks
        }

    def _fetch_live_youtube_suggestions(self, topic: str, niche: str) -> List[Dict[str, Any]]:
        """Queries Google/YouTube Suggest API for real-time live autocomplete searches.

        Search-volume/competition numbers are NOT real (the free Suggest API doesn't
        expose them), so they are never invented here — only the real query text and
        a derived search intent are returned.
        """
        results = []
        queries_to_try = [topic, f"{topic} shorts", f"{topic} tutorial", f"how to {topic}"]

        for q in queries_to_try:
            try:
                res = requests.get(
                    "http://suggestqueries.google.com/complete/search",
                    params={"client": "firefox", "ds": "yt", "q": q},
                    timeout=3
                )
                if res.ok:
                    data = res.json()
                    suggestions = data[1] if len(data) > 1 else []
                    for s in suggestions:
                        if s and not any(r["query"].lower() == s.lower() for r in results):
                            intent = "How-to" if s.lower().startswith("how") else "Curiosity" if any(w in s.lower() for w in ["best", "tool", "ai", "secret", "why"]) else "Actionable"
                            results.append({
                                "query": s,
                                "intent": intent
                            })
            except Exception as e:
                logger.debug(f"Suggest query error: {e}")

        return results

    def _offline_query_fallback(self, topic: str) -> List[Dict[str, Any]]:
        """Clearly-labeled offline suggestions when live autocomplete is unreachable."""
        return [
            {"query": f"how to {topic}", "intent": "How-to", "offline": True},
            {"query": f"{topic} tutorial", "intent": "How-to", "offline": True},
            {"query": f"best tools for {topic}", "intent": "Curiosity", "offline": True}
        ]

    def _fetch_live_competitor_videos(self, topic: str) -> List[Dict[str, Any]]:
        """Searches live YouTube via yt-dlp flat extraction for ranking competitor videos."""
        videos = []
        try:
            import yt_dlp

            ydl_opts = {
                'extract_flat': True,
                'quiet': True,
                'no_warnings': True,
                'playlistend': 8,
                'skip_download': True,
                'ignoreerrors': True
            }

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(f"ytsearch8:{topic} shorts", download=False)
                if info and 'entries' in info:
                    for entry in info['entries']:
                        if entry and entry.get("title"):
                            title = entry.get("title", "").strip()
                            video_id = entry.get("id", "")
                            uploader = entry.get("uploader") or entry.get("channel") or "YouTube Creator"
                            view_count = entry.get("view_count")
                            url = entry.get("url") or f"https://www.youtube.com/watch?v={video_id}"
                            if not url.startswith("http"):
                                url = f"https://www.youtube.com/watch?v={video_id}"

                            videos.append({
                                "title": title,
                                "uploader": uploader,
                                "view_count": view_count,
                                "url": url,
                                "id": video_id
                            })
        except Exception as e:
            logger.warning(f"Live competitor search error: {e}")

        return videos

    def _analyze_ranking_videos(self, videos: List[Dict[str, Any]], topic: str, niche: str) -> tuple:
        """Extracts factual tags and hook angles from real ranking titles."""
        all_words = []
        stop_words = {'the', 'a', 'an', 'and', 'or', 'in', 'on', 'to', 'for', 'of', 'with', 'by', 'at', 'from', 'is', 'you', 'your', 'how', 'why', 'what', 'this', 'that', 'shorts', 'video', 'youtube'}

        for v in videos:
            title = v.get("title", "")
            words = [re.sub(r'[^a-zA-Z0-9]', '', w).lower() for w in title.split()]
            all_words.extend([w for w in words if len(w) > 2 and w not in stop_words])

        from collections import Counter
        word_counts = Counter(all_words).most_common(10)
        
        tags = [f"#{w[0]}" for w in word_counts if len(w[0]) > 2]
        if not tags:
            clean_topic = re.sub(r'[^a-zA-Z0-9]', '', topic).lower()
            clean_niche = re.sub(r'[^a-zA-Z0-9]', '', niche).lower()
            tags = [f"#{clean_topic}", f"#{clean_niche}", "#viralshorts", "#automation", "#scale2026", "#growthhacks"]

        angles = []
        # Pattern analyze ranking titles
        for v in videos[:3]:
            t = v.get("title", "")
            uploader = v.get("uploader", "Competitor")
            if re.search(r'how to|tutorial', t, re.I):
                angles.append({
                    "angle_title": "Direct Tutorial & Walkthrough",
                    "why_it_works": f"Ranks high on YouTube for '{uploader}'. Viewers want instant step-by-step guidance.",
                    "suggested_twist": "Condense into a 30-second rapid-fire execution short with on-screen numbered badges."
                })
            elif re.search(r'best|top|3 |5 |10', t, re.I):
                angles.append({
                    "angle_title": "Curated Listicle & Tool Stack",
                    "why_it_works": "High CTR because viewers want curated solutions without testing everything themselves.",
                    "suggested_twist": "Rank your #1 recommendation last to maximize short retention."
                })
            else:
                angles.append({
                    "angle_title": "The Contrarian Breakdown",
                    "why_it_works": "Breaks conventional advice, driving intense comment debate and shares.",
                    "suggested_twist": "Start directly with the failed workflow vs the automated 1-click fix."
                })

        if not angles:
            angles = [
                {"angle_title": "The Step-by-Step Blueprint", "why_it_works": "Actionable instructions drive high save rates.", "suggested_twist": "Use numbered visual step badges on screen."},
                {"angle_title": "The Brutal Truth", "why_it_works": "Breaks common misconceptions, driving high comment engagement.", "suggested_twist": "Contrast a failed workflow with the fast fix."}
            ]

        return tags, angles
