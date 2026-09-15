@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

if not exist ".env.nkr" (
  echo Missing .env.nkr — copy .env.nkr.example then fill secrets.
  exit /b 1
)
if not exist "node_modules\next\dist\bin\next" (
  echo Missing Next.js. Run npm install and npm run build first.
  exit /b 1
)

set "NODE="
if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined NODE (
  for /f "delims=" %%I in ('where node 2^>nul') do (
    set "NODE=%%I"
    goto :got_node
  )
)
:got_node
if not defined NODE (
  echo node.exe not found. Install Node.js and retry.
  exit /b 1
)

set "TZ=Asia/Bangkok"
set "NODE_ENV=production"
"%NODE%" "node_modules\dotenv-cli\cli.js" -e .env.nkr -- "%NODE%" "node_modules\next\dist\bin\next" start -p 3002
exit /b %ERRORLEVEL%
