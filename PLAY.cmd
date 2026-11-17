@echo off
setlocal
cd /d "%~dp0game"
python tools\launch-game.py
if errorlevel 1 pause
