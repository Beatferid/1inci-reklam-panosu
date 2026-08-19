@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

title AR Reklam - Sunucu
echo.
echo ========================================
echo   AR Reklam Panosu - Sunucu
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [UYARI] Node.js bulunamadi. Kurulum calistiriliyor...
  call "%~dp0kurulum.bat"
  if errorlevel 1 (
    echo [HATA] Node.js ve proje bagimliliklari olusturulamadi.
    pause
    exit /b 1
  )
)

if not exist "node_modules" (
  echo [UYARI] node_modules eksik. Kurulum calistiriliyor...
  call "%~dp0kurulum.bat"
  if errorlevel 1 exit /b 1
)

if not exist ".env" (
  echo [UYARI] .env eksik. Kurulum calistiriliyor...
  call "%~dp0kurulum.bat"
  if errorlevel 1 exit /b 1
)

if not exist "node_modules" (
  echo [HATA] node_modules hala eksik. kurulum.bat ile tekrar deneyin.
  pause
  exit /b 1
)

if not exist ".env" (
  echo [HATA] .env hala eksik. kurulum.bat ile tekrar deneyin.
  pause
  exit /b 1
)

echo [..] Port 3000 kontrol ediliyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ids = @(Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); foreach ($id in $ids) { if ($id -gt 0) { try { Stop-Process -Id $id -Force -ErrorAction Stop; Write-Host ('[OK] Eski surec kapatildi: PID ' + $id) } catch {} } }; Start-Sleep -Seconds 1"
echo.

echo [..] Panel ayri uygulama penceresinde acilacak...
start "" "%~dp0ac-panel.bat"

echo Sunucu aciliyor: http://localhost:3000
echo Admin         : http://localhost:3000/admin
echo Giris         : admin / admin
echo.
echo Durdurmak icin bu pencerede Ctrl+C
echo.
call npm run dev

echo.
echo Sunucu kapandi.
pause
endlocal
