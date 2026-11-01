@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
if not exist "%~dp0start-local.cjs" (
  echo ZIPの中からは起動できません。ZIPを右クリックし「すべて展開」してください。
  echo インストール済みなら、デスクトップまたはスタートメニューのPC入力PWAから直接起動してください。
  echo インストール済みアプリの起動に、このCMDは不要です。
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js が見つかりません。Node.js 22以降をインストールし、もう一度このファイルを開いてください。
  echo https://nodejs.org/
  pause
  exit /b 1
)
node "%~dp0start-local.cjs" %*
if errorlevel 1 pause
