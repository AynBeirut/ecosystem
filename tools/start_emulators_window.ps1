param(
  [string]$RepoRoot
)

if (-not $RepoRoot) { $RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent }
Set-Location $RepoRoot
Write-Host "Starting Firebase emulators from $RepoRoot"
# Start emulators from repo root
npx firebase emulators:start --config .\firebase.json --only 'functions,firestore,auth' --project=demo-project --debug
