@echo off
title XPP-MCP
cd /d "%~dp0"
echo Starting XPP-MCP...
where node >nul 2>&1
if %ERRORLEVEL% equ 0 (
    node build\index.js
) else (
    "C:\Program Files\nodejs\node.exe" build\index.js
)
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Server exited with code %ERRORLEVEL%
    echo Make sure you ran: npm run build
    pause
)
