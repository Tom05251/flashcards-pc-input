@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js が見つかりません。Node.js 22以降をインストールし、もう一度このファイルを開いてください。
  echo https://nodejs.org/
  pause
  exit /b 1
)
node "%~dp0start-local.cjs" %*
if errorlevel 1 pause
