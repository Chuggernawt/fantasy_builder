@echo off
setlocal
title Fantasy Build (Dev)
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo  Node.js is not installed or not on your PATH.
    echo  Install it from https://nodejs.org/ then run this file again.
    echo  Or use release\Fantasy Build.exe — no Node required.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo.
    echo  First run — installing dependencies...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo  npm install failed.
        pause
        exit /b 1
    )
)

echo.
echo  Starting Fantasy Build (dev server)...
echo  Keep this window open while you play.
echo  Press Ctrl+C here to stop the server.
echo.

start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:3000"

call npm run dev

echo.
echo  Server stopped.
pause
