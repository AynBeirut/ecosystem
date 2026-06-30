@echo off
REM ===================================
REM AYN BEIRUT POS - QUICK START
REM Double-click this file to run POS
REM ===================================

echo.
echo ========================================
echo    AYN BEIRUT POS v1.0
echo    Tech made in Beirut
echo ========================================
echo.
echo Starting POS system...
echo.

REM Check for Chrome
where chrome >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Opening in Chrome...
    start chrome --app="file:///%~dp0index.html" --window-size=1400,900
    goto :end
)

REM Check for Edge
where msedge >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Opening in Edge...
    start msedge --app="file:///%~dp0index.html" --window-size=1400,900
    goto :end
)

REM Fallback to default browser
echo Opening in default browser...
start "" "%~dp0index.html"

:end
echo.
echo ✅ POS system started!
echo.
echo You can close this window now.
timeout /t 3 >nul
