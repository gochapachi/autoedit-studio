@echo off
title AutoEdit Studio - Native Windows AI Video Editor
color 0b

echo =======================================================================
echo          AUTOEDIT STUDIO - NATIVE WINDOWS DESKTOP APPLICATION
echo =======================================================================
echo.
echo [1/3] Checking Python environment...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not found in PATH! Please install Python 3.10+ from python.org.
    pause
    exit /b 1
)

:: Verify pip and auto-bootstrap if missing
python -m pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] pip module missing in Python environment. Bootstrapping pip...
    python -m ensurepip --default-pip >nul 2>&1
)

echo [2/3] Verifying Desktop App and AI Engine dependencies...
python -c "import webview, fastapi, uvicorn" >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing required runtime packages...
    python -m pip install -r engine\requirements.txt pywebview --quiet
)

echo.
echo [3/3] Launching AutoEdit Studio...
echo.

python -c "import webview" >nul 2>&1
if %errorlevel% equ 0 (
    python desktop_app.py
) else (
    echo Starting GPU Backend Engine...
    start "AutoEdit Backend" /min cmd /c "python -m uvicorn api.server:app --app-dir engine --host 127.0.0.1 --port 8000"
    echo Starting Frontend UI Server...
    start "AutoEdit Frontend" /min cmd /c "cd app && npm run dev"
    timeout /t 3 /nobreak >nul
    echo Opening Studio in browser...
    start http://localhost:3000
)
