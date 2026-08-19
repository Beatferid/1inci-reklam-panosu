@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

title AR Reklam - Cloudflare Tunnel
echo.
echo ========================================
echo   Telefon / QR icin HTTPS tunnel
echo ========================================
echo.
echo ONCE baslat.bat calisin (localhost:3000).
echo Tunnel acilinca adres .env icine yazilacak.
echo QR'i admin panelden "QR yeniden derle" edin.
echo.
echo Durdurmak: Ctrl+C
echo.

where npx >nul 2>&1
if errorlevel 1 (
  echo [HATA] npx yok. Node.js kurulu mu?
  pause
  exit /b 1
)

rem Log dosyasina yaz — URL'yi yakala ve .env guncelle
set "LOG=%TEMP%\ar-tunnel-log.txt"
del /f /q "%LOG%" >nul 2>&1

rem Cloudflare tunnel'i bagimsiz calistir; cmd icindeki nicelikli tirnak hatasini onler
start "" /b powershell -NoProfile -Command "npx --yes cloudflared tunnel --url http://127.0.0.1:3000 2>&1 | Tee-Object -FilePath '%LOG%'"

echo [..] Tunnel URL bekleniyor...
set "URL="
for /l %%i in (1,1,60) do (
  if not defined URL (
    if exist "%LOG%" (
      for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "if (Test-Path '%LOG%') { $t = Get-Content -Path '%LOG%' -Raw -Encoding Unicode -ErrorAction SilentlyContinue; if ($t -match 'https://[a-z0-9-]+\.trycloudflare\.com') { $matches[0] } }" 2^>nul`) do set "URL=%%A"
    )
  )
  if defined URL goto got_url
  timeout /t 1 /nobreak >nul
)

echo [HATA] Tunnel URL alinamadi. Log: %LOG%
type "%LOG%"
pause
exit /b 1

:got_url
echo.
echo [OK] Tunnel: !URL!
echo.

rem .env NEXT_PUBLIC_APP_URL guncelle
if not exist ".env" (
  if exist ".env.example" (
    copy /y ".env.example" ".env" >nul 2>&1
  ) else (
    type nul > ".env"
  )
)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p='.env'; $u='!URL!'; $c=Get-Content $p -Raw -ErrorAction SilentlyContinue; if ($c -match 'NEXT_PUBLIC_APP_URL=.*') { $c=[regex]::Replace($c,'NEXT_PUBLIC_APP_URL=.*','NEXT_PUBLIC_APP_URL=\"'+$u+'\"') } else { if ($c.TrimEnd() -ne '') { $c=$c.TrimEnd()+\"`r`n\" }; $c+\"NEXT_PUBLIC_APP_URL=\"$u\"`r`n\" }; Set-Content -Path $p -Value $c -NoNewline"
if errorlevel 1 (
  echo [HATA] .env guncellemesi basarisiz oldu.
  pause
  exit /b 1
)
echo [OK] .env olusturuldu/guncellendi: NEXT_PUBLIC_APP_URL=!URL!
echo.
echo ONEMLI: baslat.bat'i yeniden baslatin (env yenilensin),
echo sonra adminde «QR yeniden derle» basin.

echo.
echo Tunnel calisiyor. Bu pencereyi kapatmayin.
echo Log: %LOG%
echo.
powershell -NoProfile -Command "Get-Content '%LOG%' -Wait"
endlocal
