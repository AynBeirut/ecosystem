<#
run_local_emulators_and_smoke.ps1

Utility to help start the Firebase Emulator Suite and run the smoke test for this repo.

Usage examples (run from repo root):
  # Inspect ports and install/build functions (safe, no kills)
  powershell -ExecutionPolicy Bypass -File .\tools\run_local_emulators_and_smoke.ps1

  # Force-stop any processes listening on emulator ports, install/build, but don't start emulators
  powershell -ExecutionPolicy Bypass -File .\tools\run_local_emulators_and_smoke.ps1 -Force

  # Same as above but also start the emulators (this process will block while emulators run)
  powershell -ExecutionPolicy Bypass -File .\tools\run_local_emulators_and_smoke.ps1 -Force -StartEmulators

Notes:
- I can't run commands on your machine. This script is provided so you can run the cleanup and start steps safely and reproducibly.
- The script uses `npm install --legacy-peer-deps` when installing inside `functions` (matches what worked earlier).
- If you choose `-StartEmulators`, the script will launch the emulators in the same process and you can stop them with Ctrl+C.
#>

param(
    [switch]$Force,
    [switch]$StartEmulators
)

$ErrorActionPreference = 'Stop'

# Ports used by the emulator suite (defaults in firebase.json)
$ports = 4001,5002,8080,9099,4400,4500

Write-Host "Checking emulator ports: $($ports -join ', ')`n"
$connections = @()
try {
    $connections = Get-NetTCPConnection -LocalPort $ports -State Listen -ErrorAction Stop | Select-Object LocalAddress,LocalPort,State,OwningProcess -Unique
} catch {
    # if Get-NetTCPConnection not available, fallback to netstat
    Write-Host "Get-NetTCPConnection not available, falling back to netstat..." -ForegroundColor Yellow
    $netstat = netstat -ano | Select-String -Pattern ($ports -join '|')
    if ($netstat) {
        $pidSet = @()
        foreach ($line in $netstat) {
            $parts = ($line -split '\s+') | Where-Object { $_ -ne '' }
            if ($parts.Length -ge 5) {
                $parsedPid = 0
                if ([int]::TryParse($parts[-1], [ref]$parsedPid)) {
                    $pidSet += $parsedPid
                }
            }
        }
        $pidSet = $pidSet | Select-Object -Unique
        foreach ($foundPid in $pidSet) {
            try {
                $p = Get-Process -Id $foundPid -ErrorAction Stop
                $connections += [PSCustomObject]@{ LocalAddress = 'unknown'; LocalPort = 'unknown'; State='Listen'; OwningProcess = $foundPid }
            } catch {}
        }
    }
}

if (-not $connections -or $connections.Count -eq 0) {
    Write-Host "No processes are listening on emulator ports. Good to proceed.`n" -ForegroundColor Green
} else {
    Write-Host "Found processes listening on emulator ports:`n" -ForegroundColor Yellow
    $connections | Format-Table -AutoSize

    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique

    if (-not $Force) {
        $ans = Read-Host "Do you want to stop these processes now? Type Y to stop, anything else to abort"
        if ($ans -ne 'Y' -and $ans -ne 'y') {
            Write-Host "Aborting per user input. Free the ports or run this script again with -Force to auto-kill." -ForegroundColor Red
            exit 1
        }
    }

    Write-Host "Stopping processes: $($pids -join ', ')" -ForegroundColor Cyan
    foreach ($foundPid in $pids) {
        try {
            Stop-Process -Id $foundPid -Force -ErrorAction Stop
            Write-Host "Stopped PID $foundPid" -ForegroundColor Green
        } catch {
            Write-Host ("Failed to stop PID {0}: {1}" -f $foundPid, $_) -ForegroundColor Red
        }
    }
}

# Install/build functions
$functionsDir = Join-Path $PSScriptRoot '..' | Resolve-Path | ForEach-Object { Join-Path $_ 'functions' }
Write-Host "Installing and building functions in: $functionsDir`n"
Push-Location $functionsDir
try {
    Write-Host "Running: npm install --legacy-peer-deps"
    npm install --legacy-peer-deps
    Write-Host "Running: npm run build"
    npm run build
} catch {
    Write-Host "npm install/build failed: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

Write-Host "\nFunctions built successfully.`n" -ForegroundColor Green

if ($StartEmulators) {
    Write-Host "Starting Firebase emulators (this will block the script until you stop them with Ctrl+C)...`n" -ForegroundColor Cyan
    Push-Location (Resolve-Path ".." | ForEach-Object { $_ })
    try {
        & npx firebase-tools emulators:start --only "functions,firestore,auth" --project=demo-project --debug
    } finally {
        Pop-Location
    }
    exit 0
}

Write-Host "To start the emulators, run (from repo root):" -ForegroundColor Cyan
Write-Host "  npx firebase-tools emulators:start --only \"functions,firestore,auth\" --project=demo-project --debug`n"
Write-Host "After emulators are running, run the smoke test in another terminal:" -ForegroundColor Cyan
Write-Host "  .\functions\test_checkout_smoke.ps1`n"
Write-Host "Or run this script with -StartEmulators to start them automatically (it will block while emulators run).`n" -ForegroundColor Yellow
Write-Host "Done." -ForegroundColor Green
