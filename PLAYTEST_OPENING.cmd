@echo off
setlocal
cd /d "%~dp0game"
python tools\launch-opening-playtest.py
if errorlevel 1 pause
