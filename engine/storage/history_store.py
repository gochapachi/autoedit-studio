import os
import json
import uuid
import time
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("AutoEdit.HistoryStore")

class LocalHistoryStore:
    """
    100% Local persistent storage for creator history:
    - Researched topics and keywords
    - Generated and custom-refined scripts
    - YouTube channel deep audits
    - Saved brand profiles
    """
    def __init__(self, storage_dir: Optional[str] = None):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.storage_dir = storage_dir or os.path.join(base_dir, "storage")
        os.makedirs(self.storage_dir, exist_ok=True)
        self.file_path = os.path.join(self.storage_dir, "history.json")
        self._ensure_file()

    def _ensure_file(self):
        if not os.path.exists(self.file_path):
            initial_data = {
                "topics": [
                    {"id": "t1", "topic": "3 AI Tools That Automate Video Editing", "niche": "AI Video Marketing", "created_at": time.time(), "favorite": True},
                    {"id": "t2", "topic": "How to 10X Content Output with Local GPU", "niche": "B2B Software", "created_at": time.time() - 3600, "favorite": False}
                ],
                "scripts": [],
                "youtube_audits": [],
                "brand_profiles": []
            }
            self._write_raw(initial_data)

    def _read_raw(self) -> Dict[str, Any]:
        try:
            if os.path.exists(self.file_path):
                with open(self.file_path, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Failed to read history file: {e}")
        return {"topics": [], "scripts": [], "youtube_audits": [], "brand_profiles": []}

    def _write_raw(self, data: Dict[str, Any]):
        try:
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Failed to write history file: {e}")

    def get_all(self) -> Dict[str, Any]:
        return self._read_raw()

    def save_topic(self, topic: str, niche: str = "") -> Dict[str, Any]:
        data = self._read_raw()
        topics = data.get("topics", [])
        
        # Check if topic already exists (deduplicate)
        existing = next((t for t in topics if t.get("topic", "").lower() == topic.lower()), None)
        if existing:
            existing["created_at"] = time.time()
            if niche:
                existing["niche"] = niche
            self._write_raw(data)
            return existing

        item = {
            "id": str(uuid.uuid4())[:8],
            "topic": topic,
            "niche": niche,
            "created_at": time.time(),
            "favorite": False
        }
        topics.insert(0, item)
        data["topics"] = topics[:50]  # Keep last 50 topics
        self._write_raw(data)
        return item

    def save_script(self, script_data: Dict[str, Any], topic: str = "", script_type: str = "generated") -> Dict[str, Any]:
        data = self._read_raw()
        scripts = data.get("scripts", [])
        
        script_id = script_data.get("id") or str(uuid.uuid4())[:8]
        item = {
            "id": script_id,
            "title": script_data.get("title") or topic or "Untitled Script",
            "topic": topic or script_data.get("topic", ""),
            "script_type": script_type,  # 'generated' or 'custom_refined'
            "duration": script_data.get("estimated_seconds", 45),
            "script": script_data,
            "raw_input": script_data.get("raw_input", ""),
            "created_at": time.time(),
            "favorite": False
        }

        # Update if ID exists or prepend new
        idx = next((i for i, s in enumerate(scripts) if s.get("id") == script_id), None)
        if idx is not None:
            scripts[idx] = item
        else:
            scripts.insert(0, item)

        data["scripts"] = scripts[:100]  # Keep last 100 scripts
        self._write_raw(data)
        return item

    def save_youtube_audit(self, channel_data: Dict[str, Any]) -> Dict[str, Any]:
        data = self._read_raw()
        audits = data.get("youtube_audits", [])
        
        audit_id = str(uuid.uuid4())[:8]
        item = {
            "id": audit_id,
            "channel_title": channel_data.get("channel_title", "YouTube Channel"),
            "channel_url": channel_data.get("channel_url", ""),
            "subscriber_count": channel_data.get("subscriber_count", "N/A"),
            "video_count": channel_data.get("video_count", 0),
            "data": channel_data,
            "created_at": time.time(),
            "favorite": False
        }

        # Deduplicate by channel_url / channel_title
        audits = [a for a in audits if a.get("channel_title") != item["channel_title"] and a.get("channel_url") != item["channel_url"]]
        audits.insert(0, item)
        data["youtube_audits"] = audits[:30]
        self._write_raw(data)
        return item

    def toggle_favorite(self, category: str, item_id: str) -> bool:
        data = self._read_raw()
        items = data.get(category, [])
        for item in items:
            if item.get("id") == item_id:
                item["favorite"] = not item.get("favorite", False)
                self._write_raw(data)
                return item["favorite"]
        return False

    def delete_item(self, category: str, item_id: str) -> bool:
        data = self._read_raw()
        if category in data:
            data[category] = [i for i in data[category] if i.get("id") != item_id]
            self._write_raw(data)
            return True
        return False
