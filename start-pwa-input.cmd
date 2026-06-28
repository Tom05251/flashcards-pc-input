@echo off
setlocal

cd /d "%~dp0"

start "" "http://localhost:5173/"
npm run dev -- --host 127.0.0.1

