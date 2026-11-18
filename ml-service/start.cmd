@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Buat virtual environment dan pasang requirements.txt terlebih dahulu.
  exit /b 1
)
".venv\Scripts\python.exe" -m uvicorn main:app --env-file .env --host 127.0.0.1 --port 8000
