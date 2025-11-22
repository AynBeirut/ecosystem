# Start emulators in a separate process, wait for readiness, run the smoke test, then stop emulators.
param(
  [string]$ProjectId = 'market-flow-7b074',
  [int]$WaitSeconds = 60
)

$npx = 'npx'
$args = "firebase emulators:start --only functions,firestore,auth --project=$ProjectId --debug"
Write-Host "Starting emulators with: $npx $args"

# Start the emulator process detached so it survives this script until we stop it explicitly
try {
  # On Windows, start npx via cmd.exe so Start-Process can execute it
  $proc = Start-Process -FilePath 'cmd.exe' -ArgumentList "/c $npx $args" -NoNewWindow -PassThru
  Write-Host "Emulator process started (PID=$($proc.Id)). Waiting for services to become ready..."
} catch {
  Write-Host "Failed to start emulator process: $_";
  exit 2
}

Function Wait-UntilUp($url, $timeoutSec=120) {
  $end = (Get-Date).AddSeconds($timeoutSec)
  while((Get-Date) -lt $end) {
    try { 
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -Method Get -TimeoutSec 5; 
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return $true }
    } catch { }
    Start-Sleep -Seconds 1
  }
  return $false
}

# First wait for the Emulator UI which indicates the suite is up, then confirm the functions endpoint
$uiUrl = 'http://127.0.0.1:4001'
Write-Host "Waiting for Emulator UI at $uiUrl..."
if (-not (Wait-UntilUp $uiUrl $WaitSeconds)) {
  Write-Host "Emulator UI did not become ready within $WaitSeconds seconds. Check logs."; 
  if ($proc -and $proc.Id) { Stop-Process -Id $proc.Id -ErrorAction SilentlyContinue }
  exit 2
}

$funcUrl = 'http://127.0.0.1:5002/market-flow-7b074/us-central1/api'
Write-Host "Emulator UI ready. Waiting for Functions endpoint..."
if (-not (Wait-UntilUp $funcUrl $WaitSeconds)) {
  Write-Host "Functions endpoint did not become ready within $WaitSeconds seconds. Check emulator logs."; 
  if ($proc -and $proc.Id) { Stop-Process -Id $proc.Id -ErrorAction SilentlyContinue }
  exit 2
}

Write-Host "Functions endpoint is ready. Running smoke test..."
try {
  & pwsh -File "$(Join-Path $PSScriptRoot 'test_emulator_flow.ps1')"
  $exitCode = $LASTEXITCODE
} catch {
  Write-Host "Smoke test failed to run: $_"; $exitCode = 3
}

if ($proc -and $proc.Id) {
  Write-Host "Stopping emulator process (PID=$($proc.Id))"
  Stop-Process -Id $proc.Id -ErrorAction SilentlyContinue
} else {
  Write-Host "No emulator process PID found; attempting to stop via firebase CLI..."
  try { & cmd /c "npx firebase emulators:stop --project=$ProjectId" } catch {}
}

if ($exitCode -ne 0) { exit $exitCode } else { Write-Host "Run complete."; exit 0 }
