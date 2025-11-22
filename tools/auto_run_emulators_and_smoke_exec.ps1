<#
auto_run_emulators_and_smoke_exec.ps1

This script automates the local smoke-test run by:
  - installing & building the functions
  - starting the emulator suite via `firebase emulators:exec`
    which will start emulators, run the smoke test, then shut down emulators
  - capturing stdout/stderr to a log file

Usage (from repo root):
  powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\auto_run_emulators_and_smoke_exec.ps1

Notes:
- This script must be executed locally; the assistant cannot run it for you.
- It uses `npm install --legacy-peer-deps` inside `functions` because of peer dependency constraints.
- The smoke test script executed is `functions/test_checkout_smoke.ps1` (already present in the repo).
#>

param()

$ErrorActionPreference = 'Stop'

Write-Host "Auto-run: install/build functions, then run emulators and smoke test (emulators:exec)" -ForegroundColor Cyan

# $PSScriptRoot is the directory containing this script (the tools/ folder). Repo root is its parent.
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

$logFile = Join-Path $repoRoot "tools\emulator_and_smoke_output.txt"
if (Test-Path $logFile) { Remove-Item $logFile -Force }

try {
    Write-Host "\n1) Installing and building functions..." -ForegroundColor Yellow
    Push-Location (Join-Path $repoRoot 'functions')
    Write-Host "Running: npm install --legacy-peer-deps"
    npm install --legacy-peer-deps 2>&1 | Tee-Object -FilePath $logFile -Append
    Write-Host "Running: npm run build"
    npm run build 2>&1 | Tee-Object -FilePath $logFile -Append
    Pop-Location

    Write-Host "\n2) Starting emulator suite and running smoke test (this may take ~30s)..." -ForegroundColor Yellow
  # Build a Windows-friendly command line that runs powershell.exe via cmd /c
  $pwshPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $pwshCmd = '"' + $pwshPath + '" -NoProfile -ExecutionPolicy Bypass -File .\\functions\\test_checkout_smoke.ps1'
  $execCmd = 'npx firebase-tools emulators:exec --project=demo-project --config .\\firebase.json --only "functions,firestore,auth" -- cmd /c ' + $pwshCmd
  Write-Host "Executing: $execCmd" -ForegroundColor DarkGray

  # Run the emulators and test; capture output. Use cmd /c to ensure Windows parses the nested args.
  & npx firebase-tools emulators:exec --project=demo-project --config .\firebase.json --only "functions,firestore,auth" -- cmd /c $pwshCmd 2>&1 | Tee-Object -FilePath $logFile -Append

    Write-Host "\nCompleted. The emulator output and the smoke-test output are in: $logFile" -ForegroundColor Green
    Write-Host "Open that file to inspect the function response and Firestore REST reads." -ForegroundColor Cyan
    exit 0
} catch {
    Write-Host "\nERROR during automated run: $_" -ForegroundColor Red
    Write-Host "See partial log (if created): $logFile" -ForegroundColor Yellow
    exit 2
}
