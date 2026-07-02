@echo off
title Financial API
cd /d "%~dp0api"

echo.
echo  Starting Financial API...
echo  Running at: http://127.0.0.1:5002
echo  Press Ctrl+C to stop.
echo.

py server.py

pause
