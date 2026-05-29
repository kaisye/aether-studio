@echo off
setlocal

set "ROOT=%~dp0"
set "API_PORT=8001"
set "WEB_PORT=3000"

echo Starting Aether Studio...
echo Project: %ROOT%
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python was not found in PATH.
  echo Install Python or add it to PATH, then run this file again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found in PATH.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

if not exist "%ROOT%.env" (
  echo [WARN] .env was not found. Copy .env.example to .env and configure API keys.
  echo.
)

if not exist "%ROOT%node_modules" (
  echo Installing frontend dependencies...
  pushd "%ROOT%"
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
  popd
)

echo Releasing ports %API_PORT% and %WEB_PORT% if they are already in use...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-NetTCPConnection -LocalPort %API_PORT%,%WEB_PORT% -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo.
echo Starting backend on http://127.0.0.1:%API_PORT%
start "Aether Studio API" cmd /k "cd /d ""%ROOT%"" && python -m uvicorn app.main:app --host 127.0.0.1 --port %API_PORT% --app-dir apps/api"

echo Starting frontend on http://localhost:%WEB_PORT%/queue
start "Aether Studio Web" cmd /k "cd /d ""%ROOT%"" && npm run dev:web"

echo.
echo Aether Studio is starting.
echo Open: http://localhost:%WEB_PORT%/queue
echo.
pause
