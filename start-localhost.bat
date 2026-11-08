@echo off
title INKAI Surabaya Localhost Starter
echo ========================================================
echo   INKAI SURABAYA - SISTEM PORTAL DAN BACKEND
echo   Menjalankan Sistem Lengkap di Localhost...
echo ========================================================
echo.

:: 1. Jalankan Backend Port 5001 di jendela terpisah
echo [1/2] Menjalankan Backend API :5001...
start "INKAI Backend Server (:5001)" cmd /k "cd /d D:\website\inkai\inkai-backend && npm run dev"

:: Tunggu 3 detik agar backend siap
timeout /t 3 /nobreak >nul 2>&1

:: 2. Jalankan Frontend Portal Web Port 3000
echo [2/2] Menjalankan Frontend Portal Web :3000...
start "INKAI Surabaya Portal (:3000)" cmd /k "cd /d D:\website\inkai-sby && npm run dev"

:: Tunggu 2 detik lalu buka browser otomatis
timeout /t 2 /nobreak >nul 2>&1
echo Membuka browser: http://localhost:3000
start "" "http://localhost:3000"

echo.
echo ========================================================
echo  Layanan telah aktif di Localhost:
echo  - Portal Web : http://localhost:3000
echo  - Backend API: http://localhost:5001/api
echo  - Admin      : http://localhost:3000/admin
echo  - Dashboard  : http://localhost:3000/dashboard
echo ========================================================
