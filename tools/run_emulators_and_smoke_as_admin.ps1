# Run this PowerShell script from the repo (tools) folder by double-clicking or from an elevated PowerShell.
# It will:
# - build functions
# - stop processes listening on common emulator ports (if owned by your user)
# - start the Firebase emulators in a new PowerShell window
# - poll the Functions port and, when ready, run the smoke test in another window
# NOTE: This script must be executed locally. I cannot run it for you.

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
Write-Host "Repo root: $RepoRoot"

Push-Location $RepoRoot
try {
    Write-Host "Building functions..."
    Set-Location (Join-Path $RepoRoot 'functions')
    npm ci --legacy-peer-deps
    npm run build
    Set-Location $RepoRoot

    # ports configured in firebase.json: ui:4001 hub:4400 logging:4500 functions:5002 firestore:8080 auth:9099
    $ports = 4001,4400,4500,5002,8080,9099
    Write-Host "Checking for processes listening on: $($ports -join ', ')"
    $listeners = Get-NetTCPConnection -LocalPort $ports -State Listen -ErrorAction SilentlyContinue |
        Select-Object -Property LocalAddress,LocalPort,OwningProcess -Unique
    if ($listeners) {
        Write-Host "Found listeners:"; $listeners | Format-Table -AutoSize
        $pids = ($listeners | Select-Object -ExpandProperty OwningProcess) | Sort-Object -Unique
        Write-Host "Attempting to stop processes: $($pids -join ', ')"
        foreach ($pid in $pids) {
            try {
                # only attempt to stop if process exists
                $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
                if ($proc) {
                    Stop-Process -Id $pid -Force -ErrorAction Stop
                    Write-Host "Stopped PID $pid"
                }
            } catch {
                $msg = $_.Exception.Message -replace "[\r\n]+"," "
                Write-Warning ("Could not stop PID {0}: {1}" -f $pid, $msg)
            }
        }
    } else {
        Write-Host "No listeners found on emulator ports."
    }

    # Start emulators in a new PowerShell window via helper script to avoid quoting issues
    $startEmuScript = Join-Path $RepoRoot 'tools\start_emulators_window.ps1'
    Write-Host "Starting emulators in a new window (helper script: $startEmuScript)..."
    Start-Process -FilePath powershell -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-NoExit","-File","$startEmuScript"

    # Wait for functions port to be ready
    $maxWait = 120
    $i = 0
    Write-Host "Waiting for Functions emulator on port 5002 to become available (max $maxWait seconds)..."
    while ($i -lt $maxWait) {
        if (Test-NetConnection -ComputerName '127.0.0.1' -Port 5002 -InformationLevel Quiet) { break }
        Start-Sleep -Seconds 1
        $i++
    }
    if ($i -ge $maxWait) {
        Write-Warning "Timed out waiting for Functions emulator on port 5002. Check the emulator window for errors."
        return
    }

    Write-Host "Functions emulator appears to be listening. Launching smoke test in a new window..."
    $smokeScript = Join-Path $RepoRoot 'tools\run_smoke_test_window.ps1'
    Start-Process -FilePath powershell -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-NoExit","-File","$smokeScript"

} finally {
    Pop-Location
}
