@echo off
REM ============================================================
REM  YNC Association Portal — Push to GitHub
REM  Target repo:   https://github.com/arunchalla1/yncassociationrepo
REM  Target branch: yncprod
REM
REM  Run this from inside the site folder (double-click it, or
REM  open a terminal here and run:  github-publish.bat)
REM  Requires Git: https://git-scm.com
REM ============================================================

REM Force the working directory to this script's own folder — without this,
REM some launch methods (e.g. "Run as administrator") can start the script
REM in C:\Windows\System32 instead, which would then commit/push the wrong
REM folder entirely. See deploy-cloudflare.bat for the same issue.
cd /d "%~dp0"
echo Working in: %CD%
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed or not on PATH.
  echo Install it from https://git-scm.com then run this script again.
  pause
  exit /b 1
)

if not exist ".git" (
  echo Initializing local git repository...
  git init
)

REM Make sure the local branch is named "yncprod" to match the GitHub repo.
for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set CURBRANCH=%%b
if /i not "%CURBRANCH%"=="yncprod" (
  echo Renaming local branch to yncprod...
  git branch -M yncprod
)

echo Staging files...
git add .

git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Update: YNC Association Portal"
) else (
  echo Nothing new to commit.
)

REM Point "origin" at the existing GitHub repo (works whether or not
REM a remote named "origin" was set up before).
git remote get-url origin >nul 2>nul
if errorlevel 1 (
  git remote add origin https://github.com/arunchalla1/yncassociationrepo.git
) else (
  git remote set-url origin https://github.com/arunchalla1/yncassociationrepo.git
)

echo.
echo Pushing to https://github.com/arunchalla1/yncassociationrepo (branch: yncprod)...
echo If a browser window opens asking you to sign in, sign in to GitHub as arunchalla1.
echo (Git's credential manager handles this automatically over HTTPS — there's
echo  no separate login step to run first.)
echo.
git push -u origin yncprod

if errorlevel 1 (
  echo.
  echo ============================================================
  echo Push was rejected. This almost always means the GitHub repo
  echo already has commits that don't exist in this local folder
  echo (for example, it was created with a README or license file).
  echo.
  echo Option 1 — if the GitHub repo is empty/disposable and you want
  echo this folder's content to fully replace whatever is there:
  echo     git push -u origin yncprod --force
  echo   (Only do this if you're sure there's nothing on the GitHub
  echo    side you need to keep.)
  echo.
  echo Option 2 — merge the two histories instead:
  echo     git pull origin yncprod --allow-unrelated-histories
  echo   then resolve any conflicts Git reports, commit, and run
  echo   this script again.
  echo ============================================================
  echo.
  pause
  exit /b 1
)

echo.
echo Done. Your code is live at:
echo   https://github.com/arunchalla1/yncassociationrepo/tree/yncprod
echo.
pause
