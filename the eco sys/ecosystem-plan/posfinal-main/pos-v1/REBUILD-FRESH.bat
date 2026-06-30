@echo off
echo ========================================
echo  FRESH BUILD - AYN BEIRUT POS
echo ========================================
echo.

cd /d "%~dp0"

echo Stopping all Electron processes...
taskkill /F /IM "Ayn Beirut POS.exe" 2>nul
taskkill /F /IM electron.exe 2>nul
timeout /t 3 /nobreak >nul

echo Cleaning old dist folder...
rmdir /s /q dist 2>nul
timeout /t 2 /nobreak >nul

echo.
echo Starting fresh build...
echo.

set CSC_IDENTITY_AUTO_DISCOVERY=false
npm run build

echo.
if %ERRORLEVEL% EQU 0 (
    echo ========================================
    echo  BUILD SUCCESSFUL!
    echo ========================================
    echo.
    dir "dist\*.exe" /b 2>nul
    echo.
) else (
    echo ========================================
    echo  BUILD FAILED!
    echo ========================================
    echo Please close any running POS app and try again.
    echo.
)

pause
