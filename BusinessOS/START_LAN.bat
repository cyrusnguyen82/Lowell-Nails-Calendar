@echo off
title BusinessOS (LAN Mode)

:: Change to the Calendar root (parent of BusinessOS folder)
cd /d "%~dp0.."

:: Get local IP for display
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP: =%

echo.
echo  Starting BusinessOS in LAN mode...
echo  Local access:    http://localhost:8000
echo  Tablet / phones: http://%IP%:8000/timeclock
echo.
echo  Share the tablet URL with your employees for clock-in/out.
echo  Press Ctrl+C to stop.
echo.

python BusinessOS\app.py --host 0.0.0.0 --port 8000

pause
