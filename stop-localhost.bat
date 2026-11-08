@echo off
title INKAI Surabaya Localhost Stopper
echo ========================================================
echo   Menghentikan Layanan INKAI Surabaya di Localhost...
echo ========================================================
echo.

:: 1. Hentikan Portal Web (port 3000)
echo Menghentikan Portal Web di port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: 2. Hentikan Backend API (port 5001)
echo Menghentikan Backend API Sibling di port 5001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5001 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: 3. Hentikan Container Postgres jika docker aktif
docker info >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Menghentikan container Postgres...
    cd /d D:\website\inkai-sby && docker compose down >nul 2>&1
)

echo.
echo [OK] Seluruh layanan lokal INKAI Surabaya telah dihentikan.
ping 127.0.0.1 -n 3 >nul
