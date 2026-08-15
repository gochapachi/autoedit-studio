import os
import re
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("AutoEdit.YTDLPFetcher")

class YTDLPFetcher:
    """
    Downloads background music tracks, trending sounds, and soundscapes
    directly from YouTube, SoundCloud, or search queries using yt-dlp.
    """
    def __init__(self, download_dir: Optional[str] = None):
        self.download_dir = download_dir or os.path.join(os.getcwd(), "downloads", "audio")
        os.makedirs(self.download_dir, exist_ok=True)

    def fetch_track(self, query_or_url: str) -> Dict[str, Any]:
        """
        Downloads highest quality audio and converts to WAV/MP3.
        Accepts direct URLs or search terms (e.g. 'lo-fi chill beats').
        """
        try:
            import yt_dlp

            # Sanitize search term or URL
            is_url = query_or_url.startswith("http://") or query_or_url.startswith("https://")
            target = query_or_url if is_url else f"ytsearch1:{query_or_url} background music no copyright"

            output_template = os.path.join(self.download_dir, "%(id)s.%(ext)s")

            ydl_opts = {
                'format': 'bestaudio/best',
                'outtmpl': output_template,
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
                'quiet': True,
                'no_warnings': True,
                'max_downloads': 1
            }

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(target, download=True)
                if 'entries' in info:
                    info = info['entries'][0]

                track_id = info.get('id', 'track')
                title = info.get('title', 'Unknown Track')
                duration = info.get('duration', 0)
                file_path = os.path.join(self.download_dir, f"{track_id}.mp3")

                return {
                    "status": "success",
                    "title": title,
                    "duration": duration,
                    "file_path": file_path,
                    "id": track_id
                }

        except Exception as e:
            logger.error(f"yt-dlp fetch error: {e}")
            # Fallback mock track
            mock_path = os.path.join(self.download_dir, "default_bgm.mp3")
            return {
                "status": "error",
                "message": str(e),
                "title": query_or_url,
                "duration": 60,
                "file_path": mock_path,
                "id": "mock_bgm"
            }
