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

echo [2/3] Verifying Desktop App dependencies...
python -c "import pywebview" >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing pywebview desktop window runtime...
    python -m pip install pywebview --quiet
)

echo.
echo [3/3] Launching Native Windows Application Window...
echo.
python desktop_app.py
pause
