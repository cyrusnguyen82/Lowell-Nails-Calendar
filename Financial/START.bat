@echo off
title Financial
cd /d "%~dp0"

echo.
echo  Starting Financial (API + UI)...
echo.

start "Financial API" "%~dp0START_API.bat"
timeout /t 2 /nobreak >nul

start "Financial UI" "%~dp0START_UI.bat"
timeout /t 3 /nobreak >nul

echo  Opening http://localhost:5300 ...
start http://localhost:5300

echo.
echo  Two windows just opened: "Financial API" and "Financial UI".
echo  Leave both running. Close this window any time - it's not needed anymore.
echo.
pause
