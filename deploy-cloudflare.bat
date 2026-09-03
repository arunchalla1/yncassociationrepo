@echo off
REM ============================================================
REM  YNC Association Portal — Deploy to Cloudflare Pages
REM  Run this from inside the site folder (double-click it, or
REM  open a terminal here and run:  deploy-cloudflare.bat)
REM ============================================================

REM Re-launch inside a window that stays open no matter what happens next
REM (cmd /k never auto-closes). Guarantees the window can't flash and vanish
REM before you get to read any output, whatever goes wrong below.
if not defined YNC_DEPLOY_PERSIST (
  set YNC_DEPLOY_PERSIST=1
  cmd /k call "%~f0"
  exit /b
)

REM Force the working directory to this script's own folder. Without this,
REM launching the script in certain ways (e.g. "Run as administrator") can
REM start it in C:\Windows\System32 instead — and the deploy step below
REM uploads "." (the current directory), which would then try to upload
REM System32 itself, including huge files like MRT.exe, and fail.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not on PATH.
  echo Install it from https://nodejs.org then run this script again.
  pause
  exit /b 1
)

echo.
echo Step 1 of 2: Sign in to Cloudflare (a browser tab will open)...
echo   Skip this if you have already run "wrangler login" before.
echo.
call npx --yes wrangler login

echo.
echo Step 2 of 2: Deploying this folder to Cloudflare Pages (production: yncprod)...
echo   Folder being deployed: %CD%
echo.
call npx --yes wrangler pages deploy . --project-name=ync-association-portal --branch=yncprod

echo.
echo Done. Your live URL is printed above (also viewable at
echo https://dash.cloudflare.com under Workers ^& Pages).
echo.
pause
