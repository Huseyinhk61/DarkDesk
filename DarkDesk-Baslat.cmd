@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title DarkDesk
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js bulunamadi. Once https://nodejs.org/ adresinden Node.js 24 LTS kurun.
  echo Kurulumdan sonra bu dosyayi yeniden acin.
  pause
  exit /b 1
)
if not exist package.json (
  echo Proje dosyalari bulunamadi. ZIP dosyasini tamamen cikarin.
  pause
  exit /b 1
)
if not exist node_modules\.bin\electron.cmd (
  echo DarkDesk ilk kurulum yapiliyor...
  call npm.cmd ci
  if errorlevel 1 goto failed
)
echo DarkDesk hazirlaniyor...
call npm.cmd run desktop:preview
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo DarkDesk baslatilamadi. Yukaridaki hata metnini kontrol edin.
echo Yardim: docs\WINDOWS.md
pause
exit /b 1
