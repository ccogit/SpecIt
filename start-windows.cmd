@echo off
setlocal
cd /d "%~dp0" || exit /b 1
where node.exe >nul 2>&1
if errorlevel 1 goto missing
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
if errorlevel 1 goto missing
if not exist "server.mjs" goto incomplete
if not exist "scripts\start-windows.mjs" goto incomplete
echo Starting SpecIt. Keep this window open. Ctrl+C stops the server.
if exist ".env" (
  node --env-file=.env scripts\start-windows.mjs
) else (
  node scripts\start-windows.mjs
)
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" (
  echo SpecIt could not start or stopped with an error.
  pause
)
exit /b %RESULT%

:missing
echo Node.js 22 or newer is required: https://nodejs.org/
echo Install Node.js, then double-click this file again.
pause
exit /b 1

:incomplete
echo Repository files are missing. Check out the complete SpecIt repository.
pause
exit /b 1
