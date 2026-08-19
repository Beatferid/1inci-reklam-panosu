@echo off
chcp 65001 >nul
setlocal EnableExtensions

rem Sunucunun ayaga kalkmasi icin kisa bekleme
timeout /t 5 /nobreak >nul

set "URL=http://localhost:3000/admin"

rem Ayri pencere + adres cubugu / geri dugmesi ( --app DEGIL — oyuna gidince takilmamak icin )
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --new-window "%URL%"
  exit /b 0
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --new-window "%URL%"
  exit /b 0
)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --new-window "%URL%"
  exit /b 0
)
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
  start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" --new-window "%URL%"
  exit /b 0
)

start "" "%URL%"
endlocal
