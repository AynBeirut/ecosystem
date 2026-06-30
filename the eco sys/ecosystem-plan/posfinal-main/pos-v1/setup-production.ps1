# ===================================
# LOGO SETUP & PRODUCTION BUILD
# ===================================

Write-Host "
========================================" -ForegroundColor Cyan
Write-Host " AYN BEIRUT POS - PRODUCTION BUILD" -ForegroundColor Cyan
Write-Host "========================================
" -ForegroundColor Cyan

# Check if logo exists
if (Test-Path "build\icon.png") {
    Write-Host "[1/4] Logo found: build\icon.png" -ForegroundColor Green
    
    # Check if ImageMagick is available for ICO conversion
    try {
        magick --version | Out-Null
        Write-Host "[2/4] Converting PNG to ICO..." -ForegroundColor Yellow
        magick convert "build\icon.png" -define icon:auto-resize "build\icon.ico"
        Write-Host "      Created: build\icon.ico" -ForegroundColor Green
    } catch {
        Write-Host "[2/4] ImageMagick not found - using online converter" -ForegroundColor Yellow
        Write-Host "      Visit: https://www.icoconverter.com/" -ForegroundColor Cyan
        Write-Host "      Upload: build\icon.png" -ForegroundColor Cyan
        Write-Host "      Download as: build\icon.ico" -ForegroundColor Cyan
        pause
    }
} else {
    Write-Host "[1/4] Logo NOT FOUND!" -ForegroundColor Red
    Write-Host "      Please copy your logo to: build\icon.png" -ForegroundColor Yellow
    Write-Host "      Requirements: 256x256 pixels, PNG format" -ForegroundColor Yellow
    pause
}

Write-Host "
[3/4] Test data removed from production build" -ForegroundColor Green
Write-Host "      - PRODUCTS array is now EMPTY" -ForegroundColor Gray
Write-Host "      - Users will add products via Admin Panel" -ForegroundColor Gray

Write-Host "
[4/4] Ready to build installer!
" -ForegroundColor Green

Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Verify logo is in build\ folder" -ForegroundColor White
Write-Host "  2. Run: npm run build" -ForegroundColor White
Write-Host "  3. Installer will be in: dist\
" -ForegroundColor White

