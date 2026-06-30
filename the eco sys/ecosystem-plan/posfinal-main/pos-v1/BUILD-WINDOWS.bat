@echo off
echo ====================================
echo  AYN BEIRUT POS - Windows Builder
echo ====================================
echo.
echo This will create a Windows distribution package...
echo.

cd /d "%~dp0"

REM Set environment variables to skip code signing
set CSC_IDENTITY_AUTO_DISCOVERY=false
set WIN_CSC_LINK=

REM Clear cache
if exist "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" (
    echo Cleaning electron-builder cache...
    rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign"
    echo Cache cleared!
    echo.
)

echo Building Electron app for Windows...
echo.

call npm run build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ====================================
    echo  BUILD SUCCESSFUL!
    echo ====================================
    echo.
    echo Your Windows app is ready in the 'dist' folder!
    echo.
    pause
) else (
    echo.
    echo ====================================
    echo  BUILD FAILED!
    echo ====================================
    echo.
    echo Please check the error messages above.
    echo.
    pause
)
