@echo off
setlocal EnableExtensions
cd /d "%~dp0.."
set "ROOT=%CD%"
set "SOURCE=C:\inetpub\wwwroot\DBO_SIRIPRO_WEB\pictures"
set "DEST=%ROOT%\public\products"
set "LOGDIR=%ROOT%\logs"
set "LOG=%LOGDIR%\product-image-sync.log"

echo === StockCount Pro · sync product images ===
echo Source (read-only): %SOURCE%
echo Dest:               %DEST%
echo Shared by rooms:    :3002 (ของจริง) and :3003 (NKR)
echo.
echo This script NEVER writes, deletes, or modifies files under SalesTools.
echo.

if not exist "%SOURCE%\" (
  echo ERROR: Source folder not found. Aborting. Nothing was changed.
  echo Expected: %SOURCE%
  exit /b 1
)

if not exist "%DEST%" mkdir "%DEST%"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

echo --- %DATE% %TIME% --- >> "%LOG%"
echo Source=%SOURCE% Dest=%DEST% >> "%LOG%"

rem Read-only copy into StockCount. No /MIR /PURGE — never touch source; never delete dest orphans.
robocopy "%SOURCE%" "%DEST%" *.jpg *.jpeg *.png *.webp /XO /R:2 /W:5 /NFL /NDL /NP /LOG+:"%LOG%"
set "RC=%ERRORLEVEL%"

rem robocopy: 0-7 = success / partial copy; 8+ = failure
if %RC% GEQ 8 (
  echo FAILED. robocopy exit code %RC%. See %LOG%
  exit /b 1
)

echo.
echo OK. Copied/updated as needed ^(robocopy exit %RC%^).
echo Log: %LOG%
echo Both rooms :3002 and :3003 serve files from public\products
exit /b 0
