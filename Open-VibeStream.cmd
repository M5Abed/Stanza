@echo off
setlocal EnableExtensions
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js was not found in PATH.
  echo  Install LTS from https://nodejs.org/ then double-click this file again.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm not found. Reinstall Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" (
    copy /Y ".env.example" ".env" >nul
    echo Created .env from .env.example — edit it to add Spotify keys if needed.
  )
)

if not exist "node_modules\" (
  echo Installing dependencies ^(first run only^)...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

if exist "prisma\migrations\" (
  call npx prisma migrate deploy >nul 2>&1
)

echo Starting VibeStream...
call npm run dev
set ERR=%ERRORLEVEL%
if not "%ERR%"=="0" (
  echo.
  echo Dev server exited with code %ERR%.
  pause
)
exit /b %ERR%
