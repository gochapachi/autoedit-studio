@echo off
title AutoEdit Studio - Native Windows AI Video Editor
color 0b

echo =======================================================================
echo          AUTOEDIT STUDIO - NATIVE WINDOWS GPU AI VIDEO ENGINE
echo =======================================================================
echo.
echo [1/4] Checking Python and CUDA environment...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not found in PATH! Please install Python 3.10+ from python.org.
    pause
    exit /b 1
)

echo [2/4] Setting up Python Virtual Environment...
if not exist "engine\venv" (
    echo Creating virtual environment in engine\venv...
    python -m venv engine\venv
)
call engine\venv\Scripts\activate.bat

echo Installing / Verifying engine dependencies...
pip install -r engine\requirements.txt --quiet

echo.
echo [3/4] Starting Local Python GPU Engine (FastAPI on Port 8000)...
start /b python engine\main.py

echo.
echo [4/4] Starting Modern Studio Desktop UI (Next.js on Port 3000)...
cd app
call npm.cmd install --silent
start /b npm.cmd run dev

timeout /t 3 >nul
echo.
echo =======================================================================
echo   AutoEdit Studio is running at: http://localhost:3000
echo   Engine API is running at:      http://127.0.0.1:8000
echo =======================================================================
echo.
start http://localhost:3000
echo Press Ctrl+C or close this window to stop the studio.
pause >nul
