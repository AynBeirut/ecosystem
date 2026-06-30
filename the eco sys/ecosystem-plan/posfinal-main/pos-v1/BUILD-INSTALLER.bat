@echo off
REM ============================================================================
REM Build Windows Installer for Ayn Beirut POS
REM ============================================================================

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          BUILDING WINDOWS INSTALLER                        ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found!
    echo Please install from: https://nodejs.org/
    pause
    exit /b 1
)

REM Check dependencies
if not exist "node_modules\" (
    echo [INFO] Installing dependencies first...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies!
        pause
        exit /b 1
    )
)

echo [INFO] Building Windows installer...
echo This may take 5-10 minutes...
echo.

call npm run build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ╔════════════════════════════════════════════════════════════╗
    echo ║                BUILD SUCCESSFUL!                           ║
    echo ╚════════════════════════════════════════════════════════════╝
    echo.
    echo Installer location:
    echo   dist\Ayn-Beirut-POS-Setup-1.0.0.exe
    echo.
    echo You can now distribute this installer to users!
    echo.
) else (
    echo.
    echo ╔════════════════════════════════════════════════════════════╗
    echo ║                  BUILD FAILED!                             ║
    echo ╚════════════════════════════════════════════════════════════╝
    echo.
    echo Check the error messages above for details.
    echo.
)

pause
