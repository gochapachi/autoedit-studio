import os
import re
import json
import shutil
import subprocess
import logging
import requests
from typing import Dict, Any, List, Optional, Callable

logger = logging.getLogger("AutoEdit.OllamaManager")

# Unsloth publishes their models on Hugging Face as GGUF repos; modern Ollama
# pulls them directly as "hf.co/<repo>:<quant>". Fallback list used when the
# Hugging Face API is unreachable. Sizes are approximate Q4_K_M downloads.
CURATED_UNSLOTH_MODELS = [
    {"name": "hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M", "size": "~2.5GB", "description": "Fast, sharp instruction model — great all-round pick for scripts"},
    {"name": "hf.co/unsloth/gemma-3-1b-it-GGUF:Q4_K_M", "size": "~0.8GB", "description": "Tiny and quick — best for low VRAM"},
    {"name": "hf.co/unsloth/Qwen3-8B-Instruct-2507-GGUF:Q4_K_M", "size": "~5GB", "description": "Higher quality writing, needs more VRAM"},
    {"name": "hf.co/unsloth/Llama-3.2-3B-Instruct-GGUF:Q4_K_M", "size": "~2GB", "description": "Classic reliable small model"},
    {"name": "hf.co/unsloth/DeepSeek-R1-Distill-Llama-8B-GGUF:Q4_K_M", "size": "~5GB", "description": "Reasoning model — slower but thoughtful"},
]

# Rough Q4_K_M download size per billion parameters (GGUF q4 ≈ 0.6 GiB/B params)
_Q4_GB_PER_B = 0.62


def _estimate_q4_size(model_id: str) -> str:
    m = re.search(r"(\d+(?:\.\d+)?)\s*[Bb](?![A-Za-z])", model_id)
    if not m:
        return ""
    try:
        billions = float(m.group(1))
        if "A3B" in model_id or "A4B" in model_id:
            # MoE models have many more total weights than active params
            billions = max(billions * 3.5, 3.0)
        gb = billions * _Q4_GB_PER_B
        return f"~{gb:.0f}GB" if gb >= 1 else f"~{gb:.1f}GB"
    except Exception:
        return ""


class OllamaManager:
    """
    Keeps the local Ollama daemon alive and manages model discovery/install.
    100% local: starts `ollama serve` on demand, lists installed models,
    searches the Unsloth model library, and streams model pulls with progress.
    """

    def __init__(self, ollama_url: str = "http://127.0.0.1:11434"):
        self.ollama_url = os.getenv("AUTOEDIT_OLLAMA_URL", ollama_url).rstrip("/")

    # ---------- daemon lifecycle ----------

    def is_running(self, timeout: float = 1.5) -> bool:
        try:
            res = requests.get(f"{self.ollama_url}/api/version", timeout=timeout)
            return res.ok
        except Exception:
            return False

    def _resolve_ollama_exe(self) -> Optional[str]:
        exe = shutil.which("ollama")
        if exe:
            return exe
        # Windows default install locations (per-user and for-service paths)
        candidates = [
            os.path.expandvars(r"%LOCALAPPDATA%\Programs\Ollama\ollama.exe"),
            r"C:\Program Files\Ollama\ollama.exe",
            "/usr/local/bin/ollama",
            "/usr/bin/ollama",
        ]
        for c in candidates:
            if os.path.exists(c):
                return c
        return None

    def ensure_running(self, wait_seconds: float = 25.0) -> Dict[str, Any]:
        """
        Starts the Ollama daemon if it isn't running and waits until it answers.
        Returns {running, started, exe, version, error}.
        """
        if self.is_running():
            return self._running_status(started=False)

        exe = self._resolve_ollama_exe()
        if not exe:
            return {
                "running": False,
                "started": False,
                "exe": None,
                "version": None,
                "error": "Ollama is not installed. Install it from https://ollama.com/download and try again.",
            }

        try:
            creationflags = 0
            if os.name == "nt":
                creationflags = (
                    getattr(subprocess, "CREATE_NO_WINDOW", 0)
                    | getattr(subprocess, "DETACHED_PROCESS", 0)
                )
            subprocess.Popen(
                [exe, "serve"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=creationflags,
                close_fds=True,
            )
            logger.info(f"Launched 'ollama serve' from {exe}; waiting for readiness…")
        except Exception as e:
            return {
                "running": False,
                "started": False,
                "exe": exe,
                "version": None,
                "error": f"Could not start Ollama: {e}",
            }

        # Poll until the daemon answers (model server can take a few seconds)
        import time
        deadline = time.time() + wait_seconds
        while time.time() < deadline:
            if self.is_running():
                logger.info("Ollama daemon is up.")
                return self._running_status(started=True)
            time.sleep(0.5)

        return {
            "running": False,
            "started": True,
            "exe": exe,
            "version": None,
            "error": "Ollama was started but did not respond in time. Try again in a few seconds.",
        }

    def _running_status(self, started: bool) -> Dict[str, Any]:
        version = None
        try:
            res = requests.get(f"{self.ollama_url}/api/version", timeout=2)
            if res.ok:
                version = res.json().get("version")
        except Exception:
            pass
        return {"running": True, "started": started, "exe": None, "version": version, "error": None}

    # ---------- models ----------

    def list_installed_models(self) -> List[str]:
        try:
            res = requests.get(f"{self.ollama_url}/api/tags", timeout=3)
            if res.ok:
                return [m.get("name", "") for m in res.json().get("models", []) if m.get("name")]
        except Exception:
            pass
        return []

    def search_unsloth_models(self, query: str = "", limit: int = 20) -> Dict[str, Any]:
        """
        Live search of Unsloth's GGUF library on Hugging Face. Models are
        returned in Ollama's hf.co pull form ("hf.co/<repo>:Q4_K_M") so they can
        be installed directly. Falls back to a curated list when offline.
        """
        models: List[Dict[str, Any]] = []
        source = "curated-offline"
        try:
            params = {
                "author": "unsloth",
                "filter": "gguf",
                "sort": "downloads",
                "direction": -1,
                "limit": max(limit, 20),
            }
            if query.strip():
                params["search"] = query.strip()
            res = requests.get(
                "https://huggingface.co/api/models", params=params, timeout=10
            )
            if res.ok:
                for m in res.json():
                    repo = m.get("id", "")
                    if not repo:
                        continue
                    models.append({
                        "name": f"hf.co/{repo}:Q4_K_M",
                        "repo": repo,
                        "size": _estimate_q4_size(repo),
                        "downloads": m.get("downloads", 0),
                        "likes": m.get("likes", 0),
                        "description": "",
                    })
                if models:
                    source = "huggingface.co"
        except Exception as e:
            logger.debug(f"Unsloth HF search failed: {e}")

        if not models:
            models = [dict(m) for m in CURATED_UNSLOTH_MODELS]

        curated = {m["name"].lower(): m for m in CURATED_UNSLOTH_MODELS}
        for m in models:
            c = curated.get(m["name"].lower())
            if c:
                if not m.get("description"):
                    m["description"] = c["description"]
                if not m.get("size"):
                    m["size"] = c["size"]

        installed = set(n.lower() for n in self.list_installed_models())
        for m in models:
            m["installed"] = m["name"].lower() in installed

        models.sort(key=lambda m: not m["installed"])
        return {"status": "success", "source": source, "models": models[:24]}

    def pull_model_stream(self, model_name: str, progress_cb: Optional[Callable[[int, str], None]] = None) -> Dict[str, Any]:
        """
        Streams a model pull, reporting percentage via progress_cb.
        Blocks until the download finishes (multi-GB downloads take minutes).
        """
        last_pct = -1
        try:
            with requests.post(
                f"{self.ollama_url}/api/pull",
                json={"name": model_name, "stream": True},
                stream=True,
                timeout=None,
            ) as res:
                if not res.ok:
                    return {"status": "error", "error": f"Pull failed ({res.status_code})"}
                for line in res.iter_lines(decode_unicode=True):
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                    except Exception:
                        continue
                    status = data.get("status", "")
                    total = data.get("total")
                    completed = data.get("completed")
                    if total and completed:
                        pct = min(99, int(completed / total * 100))
                        if pct > last_pct:
                            last_pct = pct
                            if progress_cb:
                                progress_cb(pct, f"Downloading {model_name}… {pct}%")
                    if "error" in data:
                        return {"status": "error", "error": data["error"]}
            if progress_cb:
                progress_cb(100, f"{model_name} installed")
            logger.info(f"Model pull complete: {model_name}")
            return {"status": "success", "model": model_name}
        except Exception as e:
            return {"status": "error", "error": str(e)}
