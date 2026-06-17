@echo off
REM Dev mode — needs Node.js installed. Use "release\Fantasy Build.exe" for USB / other PCs.
cd /d "%~dp0"
if exist "release\Fantasy Build.exe" (
    echo.
    echo  Portable build found. Launching release\Fantasy Build.exe ...
    echo.
    start "" "%~dp0release\Fantasy Build.exe"
    exit /b 0
)
call "%~dp0Play Fantasy Build (Dev).bat"
