@echo off
setlocal EnableExtensions
echo === Open Windows Firewall for Test (:3001) and NKR (:3002) ===
echo Run this file as Administrator.
echo.

netsh advfirewall firewall delete rule name="StockCount Pro Test 3001" >nul 2>nul
netsh advfirewall firewall add rule name="StockCount Pro Test 3001" dir=in action=allow protocol=TCP localport=3001 profile=any
if errorlevel 1 goto :fail

netsh advfirewall firewall delete rule name="StockCount Pro NKR 3002" >nul 2>nul
netsh advfirewall firewall add rule name="StockCount Pro NKR 3002" dir=in action=allow protocol=TCP localport=3002 profile=any
if errorlevel 1 goto :fail

echo OK. Tablets can reach:
echo   Test  http://^<IP^>:3001
echo   NKR   http://^<IP^>:3002
echo.
echo Of production :3000 is already open, leave it. This script does not change 3000.
exit /b 0

:fail
echo Firewall rule failed. Right-click the bat - Run as administrator.
exit /b 1
