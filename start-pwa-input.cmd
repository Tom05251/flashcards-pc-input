@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
if not exist "%~dp0local-preview\start-local.cjs" (
  echo Launcher files are missing. Extract the complete ZIP first.
  echo If the app is installed, open its desktop or Start menu shortcut directly.
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or later is required: https://nodejs.org/
  pause
  exit /b 1
)
node "%~dp0local-preview\start-local.cjs" %*
if errorlevel 1 pause

