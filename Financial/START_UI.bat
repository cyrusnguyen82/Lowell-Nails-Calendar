@echo off
title Financial UI
cd /d "%~dp0ui"

echo.
echo  Starting Financial UI (Vite dev server)...
echo  Open your browser to: http://localhost:5300
echo  Requires the Financial API (START_API.bat) to already be running.
echo  Press Ctrl+C to stop.
echo.

npm run dev

pause
