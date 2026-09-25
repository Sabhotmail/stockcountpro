@echo off
setlocal EnableExtensions
cd /d "%~dp0.."
set "ROOT=%CD%"
set "SYNC=%ROOT%\scripts\sync-product-images.bat"

rem Unique task per project folder so :3002 and :3003 installs do not overwrite each other.
for %%I in ("%ROOT%") do set "ROOTNAME=%%~nxI"
set "TASK=StockCountPro-ProductImageSync-%ROOTNAME%"

echo === Install scheduled task: %TASK% ===
echo Repo: %ROOT%
echo Runs daily at 06:00 — copies SalesTools pictures ^(read-only^) into this folder's public\products
echo.
echo If ของจริง and NKR live in different folders, run this install ONCE in each folder.
echo Run this file as Administrator.
echo.

if not exist "%SYNC%" (
  echo Missing %SYNC%
  exit /b 1
)

schtasks /Delete /TN "%TASK%" /F >nul 2>nul
rem Also remove the old shared name from the first release, if present.
schtasks /Delete /TN "StockCountPro-ProductImageSync" /F >nul 2>nul

schtasks /Create /TN "%TASK%" /TR "\"%SYNC%\"" /SC DAILY /ST 06:00 /RL HIGHEST /F
if errorlevel 1 (
  echo Failed to create scheduled task. Right-click - Run as administrator.
  exit /b 1
)

echo.
echo OK. Task installed: %TASK%
echo Schedule: daily 06:00
echo Manual run: "%SYNC%"
echo Query:    schtasks /Query /TN "%TASK%" /V /FO LIST
echo Remove:   schtasks /Delete /TN "%TASK%" /F
exit /b 0
