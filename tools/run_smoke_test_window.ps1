param(
  [string]$RepoRoot
)

if (-not $RepoRoot) { $RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent }
Set-Location $RepoRoot
Write-Host "Running smoke test from $RepoRoot"
powershell -NoProfile -ExecutionPolicy Bypass -File .\functions\test_checkout_smoke.ps1
