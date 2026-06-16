@echo off
REM ============================================================
REM  Interactive Learning - dev launcher
REM  Installs dependencies (first run) then starts Next.js.
REM ============================================================

cd /d "%~dp0"

REM Check Node is available
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not on PATH.
    echo Download it from https://nodejs.org/ and try again.
    pause
    exit /b 1
)

REM Install dependencies on first run
if not exist "node_modules" (
    echo Installing dependencies, please wait...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

echo Starting the app at http://localhost:3000 ...
start "" http://localhost:3000
call npm run dev

pause
