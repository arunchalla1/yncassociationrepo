@echo off
REM ============================================================
REM  YNC Association Portal — Publish to GitHub as "YNC Portal"
REM  Run this from inside the site folder (double-click it, or
REM  open a terminal here and run:  github-publish.bat)
REM
REM  Requires Git (https://git-scm.com) and, ideally, the GitHub
REM  CLI "gh" (https://cli.github.com) for full automation.
REM  Without "gh" this script still prepares everything locally
REM  and tells you the one manual step left.
REM ============================================================

where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed or not on PATH.
  echo Install it from https://git-scm.com then run this script again.
  pause
  exit /b 1
)

if not exist ".git" (
  echo Initializing git repository...
  git init
  git branch -M main
)

echo Staging files...
git add .

git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Initial commit: YNC Association Portal v1.1.0"
) else (
  echo Nothing new to commit.
)

where gh >nul 2>nul
if errorlevel 1 (
  echo.
  echo GitHub CLI "gh" was not found, so the last step is manual:
  echo   1. Create a new repo named "YNC Portal" at https://github.com/new
  echo      (do NOT initialize it with a README - this folder already has one)
  echo   2. Then run these two commands here:
  echo        git remote add origin https://github.com/YOUR-USERNAME/YNC-Portal.git
  echo        git push -u origin main
  echo.
  pause
  exit /b 0
)

echo.
echo Checking GitHub CLI sign-in...
gh auth status >nul 2>nul
if errorlevel 1 (
  echo Signing in to GitHub (a browser tab will open)...
  gh auth login
)

echo.
echo Creating GitHub repository "YNC Portal" and pushing...
gh repo create "YNC Portal" --private --source=. --remote=origin --push

echo.
echo Done. Your repository is now live on GitHub.
echo Run "gh repo view --web" to open it in your browser.
echo.
pause
