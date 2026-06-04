@echo off
title BusinessOS

:: Change to the Calendar root (parent of BusinessOS folder)
cd /d "%~dp0.."

echo.
echo  Starting BusinessOS...
echo  Open your browser to: http://localhost:8000
echo  Press Ctrl+C to stop.
echo.

python BusinessOS\app.py --host 127.0.0.1 --port 8000

pause
