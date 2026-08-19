@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

title AR Reklam - Kurulum
echo.
echo ========================================
echo   AR Reklam Panosu - Sifirdan Kurulum
echo ========================================
echo.

call :ensure_node
if errorlevel 1 (
  echo.
  echo [HATA] Node.js kurulamadi. Elle kurun: https://nodejs.org/
  echo Sonra bu dosyayi tekrar calistirin.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v 2^>nul') do set NODEVER=%%v
for /f "tokens=*" %%v in ('npm -v 2^>nul') do set NPMVER=%%v
for /f "tokens=*" %%v in ('npx -v 2^>nul') do set NPXVER=%%v
if not defined NPMVER set NPMVER=bulunamadi
if not defined NPXVER set NPXVER=bulunamadi

echo [OK] Node.js: !NODEVER! ^| npm: !NPMVER! ^| npx: !NPXVER!
echo.

if not exist "package.json" (
  echo [HATA] package.json yok. Yanlis klasorde misiniz?
  pause
  exit /b 1
)

if not exist ".env" (
  echo [.env] Ornek dosyadan olusturuluyor...
  if exist ".env.example" (
    copy /Y ".env.example" ".env" >nul
  ) else (
    (
      echo DATABASE_URL="file:./dev.db"
      echo AUTH_SECRET="degistir-beni-uzun-gizli-anahtar"
      echo ADMIN_EMAIL="admin"
      echo ADMIN_PASSWORD="admin"
      echo NEXT_PUBLIC_APP_URL="http://localhost:3000"
    ) > ".env"
  )
  echo [OK] .env hazir. Isterseniz ADMIN_EMAIL / ADMIN_PASSWORD degistirin.
) else (
  echo [OK] .env zaten var.
)
echo.

echo [1/4] Paketler yukleniyor (bu biraz surebilir)...
rem --ignore-scripts: bazi bagimliliklarin (orn. canvas) native derlemesi
rem Visual Studio Build Tools gerektirir ve kullanilmiyor; atlanir.
rem Prisma client asagida ayrica (adim 2/4) elle uretilir.
call npm install --ignore-scripts
if errorlevel 1 (
  echo [HATA] npm install basarisiz.
  echo [ONERI] Internet baglantisi, antivirus, paket bagimliliklari veya Node.js versiyonunu kontrol edin.
  echo [ONERI] Gerekiyorsa bu dosyayi yonetici olarak calistirin.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [HATA] node_modules klasoru olusturulamadi.
  pause
  exit /b 1
)

echo.
echo [2/4] Prisma client uretiliyor...
call npx prisma generate
if errorlevel 1 (
  echo [UYARI] prisma generate sorun cikardi, devam deneniyor...
)

echo.
echo [3/4] Veritabani hazirlaniyor...
call npx prisma db push
if errorlevel 1 (
  echo [HATA] Veritabani olusturulamadi.
  pause
  exit /b 1
)

echo.
echo [4/4] Admin hesabi seed...
call npm run db:seed
if errorlevel 1 (
  echo [UYARI] Seed basarisiz olabilir; .env admin bilgilerini kontrol edin.
)

if not exist "storage" mkdir storage
if not exist "storage\targets" mkdir storage\targets
if not exist "storage\media" mkdir storage\media
if not exist "storage\compiled" mkdir storage\compiled

echo.
echo ========================================
echo   KURULUM TAMAM
echo ========================================
echo.
echo   Panel : http://localhost:3000/admin
echo   Giris : admin  /  admin
echo           (.env icindeki ADMIN_* ile degisir)
echo           Panelden: Hesap / Sifre
echo.
echo   Sunucuyu baslatmak icin:  baslat.bat
echo   Telefonda HTTPS icin   :  tunnel.bat  (ayri pencere)
echo.
echo Simdi sunucu baslatilsin mi?
choice /C YN /M "baslat.bat calistir"
if errorlevel 2 goto end
if errorlevel 1 call "%~dp0baslat.bat"
goto end

:end
echo.
pause
endlocal
exit /b 0

rem ========== Node.js kontrol + otomatik kurulum ==========
:ensure_node
call :refresh_node_path
where node >nul 2>&1
if not errorlevel 1 (
  call :node_major_ok
  if not errorlevel 1 exit /b 0
  echo [UYARI] Node.js cok eski ^(20+ lazim^). Guncelleniyor...
) else (
  echo [BILGI] Node.js yok — otomatik kurulacak ^(20 LTS^)...
)

echo.
echo Yonetici izni gerekebilir. Biraz bekleyin...
echo.

rem 1) winget
where winget >nul 2>&1
if not errorlevel 1 (
  echo [..] winget ile Node.js LTS kuruluyor...
  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --disable-interactivity
  call :refresh_node_path
  where node >nul 2>&1
  if not errorlevel 1 (
    call :node_major_ok
    if not errorlevel 1 (
      echo [OK] winget ile kuruldu.
      exit /b 0
    )
  )
)

rem 2) MSI indir + sessiz kur
set "NODE_MSI=%TEMP%\node-v20-x64.msi"
set "NODE_URL=https://nodejs.org/dist/v20.19.5/node-v20.19.5-x64.msi"
echo [..] Node.js 20 MSI indiriliyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_MSI%' -UseBasicParsing; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"
if errorlevel 1 (
  echo [HATA] Indirme basarisiz. Internet / antivirus kontrol edin.
  exit /b 1
)

echo [..] Sessiz kurulum ^(msiexec^)...
msiexec /i "%NODE_MSI%" /qn ADDLOCAL=ALL
set "MSIERR=!errorlevel!"
del /f /q "%NODE_MSI%" >nul 2>&1

call :refresh_node_path
where node >nul 2>&1
if errorlevel 1 (
  echo [HATA] Kurulum sonrasi node PATH'te yok ^(cikis kodu !MSIERR!^).
  echo Bu BAT'i "Yonetici olarak calistir" ile tekrar deneyin.
  exit /b 1
)

call :node_major_ok
if errorlevel 1 (
  echo [HATA] Node 20+ hala yok.
  exit /b 1
)

echo [OK] Node.js kuruldu.
exit /b 0

:refresh_node_path
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%LocalAppData%\Programs\node\node.exe" set "PATH=%LocalAppData%\Programs\node;%PATH%"
if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
rem Makine + kullanici PATH'ini yenile
for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYSPATH=%%B"
for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USRPATH=%%B"
if defined SYSPATH set "PATH=%SYSPATH%;%PATH%"
if defined USRPATH set "PATH=%USRPATH%;%PATH%"
exit /b 0

:node_major_ok
for /f "tokens=1 delims=v." %%a in ('node -v 2^>nul') do set "MAJOR=%%a"
if not defined MAJOR exit /b 1
if !MAJOR! LSS 20 exit /b 1
exit /b 0
