@echo off
REM ============================================================
REM  YNC Association Portal — Deploy to Cloudflare Pages
REM  Run this from inside the site folder (double-click it, or
REM  open a terminal here and run:  deploy-cloudflare.bat)
REM ============================================================

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
echo Step 2 of 2: Deploying this folder to Cloudflare Pages...
echo.
call npx --yes wrangler pages deploy . --project-name=ync-association-portal

echo.
echo Done. Your live URL is printed above (also viewable at
echo https://dash.cloudflare.com under Workers ^& Pages).
echo.
pause
