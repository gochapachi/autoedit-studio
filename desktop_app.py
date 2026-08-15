import os
import sys
import time
import threading
import subprocess
import urllib.request
import webview

# Add engine directory to path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BASE_DIR, "engine"))

def start_backend_server():
    """Starts FastAPI engine daemon in the background."""
    import uvicorn
    from api.server import app
    print("[Desktop App] Starting local GPU AI Engine on http://127.0.0.1:8000...")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")

def wait_for_service(url, timeout=15):
    """Waits until the HTTP endpoint responds."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen(url) as response:
                if response.status == 200:
                    return True
        except Exception:
            time.sleep(0.4)
    return False

def main():
    print("=================================================================")
    print("      LAUNCHING AUTOEDIT STUDIO NATIVE WINDOWS DESKTOP APP       ")
    print("=================================================================")

    # 1. Start Python Backend Engine in background thread
    t = threading.Thread(target=start_backend_server, daemon=True)
    t.start()

    # 2. Check if Next.js dev server is running, if not, spawn it
    ui_ready = wait_for_service("http://localhost:3000", timeout=2)
    if not ui_ready:
        print("[Desktop App] Starting Desktop UI Server...")
        app_dir = os.path.join(BASE_DIR, "app")
        subprocess.Popen(["npm.cmd", "run", "dev"], cwd=app_dir, shell=True)
        wait_for_service("http://localhost:3000", timeout=12)

    print("[Desktop App] Opening Native Windows Application Window...")

    # 3. Create Sleek Standalone Windows App Window (Edge Chromium WebView2)
    window = webview.create_window(
        title="AutoEdit Studio - Local GPU AI Video Editor",
        url="http://localhost:3000",
        width=1440,
        height=920,
        min_size=(1100, 700),
        background_color="#090a0f",
        text_select=True,
        zoomable=True
    )

    # 4. Start Native Event Loop
    webview.start(gui="edgechromium", debug=False)

if __name__ == "__main__":
    main()
