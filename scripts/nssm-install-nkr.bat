@echo off
setlocal EnableExtensions
cd /d "%~dp0.."
set "ROOT=%CD%"
set "SERVICE=StockCountPro-NKR"
set "RUNNER=%ROOT%\scripts\run-nkr-service.bat"
set "LOGDIR=%ROOT%\logs"

echo === NSSM install %SERVICE% (port 3002, .env.nkr) ===
echo Repo: %ROOT%
echo Run this file as Administrator.
echo.

if not exist "%RUNNER%" (
  echo Missing %RUNNER%
  exit /b 1
)
if not exist ".env.nkr" (
  echo Missing .env.nkr — copy .env.nkr.example then fill secrets before starting the service.
)

set "NSSM="
for /f "delims=" %%I in ('where nssm 2^>nul') do (
  set "NSSM=%%I"
  goto :got_nssm
)
if exist "%ProgramFiles%\nssm\nssm.exe" set "NSSM=%ProgramFiles%\nssm\nssm.exe"
if exist "%ProgramFiles%\nssm\win64\nssm.exe" set "NSSM=%ProgramFiles%\nssm\win64\nssm.exe"
if exist "C:\nssm\win64\nssm.exe" set "NSSM=C:\nssm\win64\nssm.exe"
:got_nssm
if not defined NSSM (
  echo nssm.exe not found. Install NSSM and add it to PATH.
  exit /b 1
)

if not exist "%LOGDIR%" mkdir "%LOGDIR%"

"%NSSM%" stop "%SERVICE%" >nul 2>nul
"%NSSM%" remove "%SERVICE%" confirm >nul 2>nul
"%NSSM%" install "%SERVICE%" "%RUNNER%"
if errorlevel 1 (
  echo nssm install failed.
  exit /b 1
)

"%NSSM%" set "%SERVICE%" AppDirectory "%ROOT%"
"%NSSM%" set "%SERVICE%" DisplayName "StockCount Pro NKR"
"%NSSM%" set "%SERVICE%" Description "Temporary NKR room on port 3002 (.env.nkr, Express 8082)"
"%NSSM%" set "%SERVICE%" Start SERVICE_AUTO_START
"%NSSM%" set "%SERVICE%" AppStdout "%LOGDIR%\nkr-service.log"
"%NSSM%" set "%SERVICE%" AppStderr "%LOGDIR%\nkr-service.err.log"
"%NSSM%" set "%SERVICE%" AppRotateFiles 1
"%NSSM%" set "%SERVICE%" AppRotateBytes 10485760
"%NSSM%" set "%SERVICE%" AppRestartDelay 5000
"%NSSM%" set "%SERVICE%" AppStopMethodSkip 0
"%NSSM%" set "%SERVICE%" AppEnvironmentExtra TZ=Asia/Bangkok NODE_ENV=production

echo.
echo Opening Windows Firewall TCP 3002 (NKR room) ...
netsh advfirewall firewall delete rule name="StockCount Pro NKR 3002" >nul 2>nul
netsh advfirewall firewall add rule name="StockCount Pro NKR 3002" dir=in action=allow protocol=TCP localport=3002 profile=any
if errorlevel 1 (
  echo Firewall rule failed. Run this bat as Administrator.
)

echo.
echo Starting %SERVICE% ...
"%NSSM%" start "%SERVICE%"
if errorlevel 1 (
  echo Start failed. Check %LOGDIR%\nkr-service.err.log
  exit /b 1
)

echo.
echo OK. NKR room service: %SERVICE%
echo URL: http://%COMPUTERNAME%:3002
echo Firewall: inbound TCP 3002
echo Logs: %LOGDIR%\nkr-service.log
echo Stop:  nssm stop %SERVICE%
echo Remove: nssm stop %SERVICE% ^& nssm remove %SERVICE% confirm
exit /b 0
