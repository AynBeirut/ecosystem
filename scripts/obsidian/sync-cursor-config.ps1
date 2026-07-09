param(
  [Parameter(Mandatory=$true)]
  [string]$SourceDir
)

# Sync shared rules/skills from global AI core repo to Cursor user folders.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\obsidian\sync-cursor-config.ps1 -SourceDir "C:\path\grabio-ai-core"

if (!(Test-Path $SourceDir)) {
  Write-Error "Source directory not found: $SourceDir"
  exit 1
}

$rulesSrc = Join-Path $SourceDir "rules"
$skillsSrc = Join-Path $SourceDir "skills"

if (!(Test-Path $rulesSrc)) {
  Write-Error "Missing folder: $rulesSrc"
  exit 1
}

if (!(Test-Path $skillsSrc)) {
  Write-Error "Missing folder: $skillsSrc"
  exit 1
}

$cursorDir = Join-Path $env:USERPROFILE ".cursor"
$rulesDest = Join-Path $cursorDir "rules"
$skillsDest = Join-Path $cursorDir "skills"

New-Item -ItemType Directory -Path $rulesDest -Force | Out-Null
New-Item -ItemType Directory -Path $skillsDest -Force | Out-Null

robocopy $rulesSrc $rulesDest /MIR /NFL /NDL /NJH /NJS /NC /NS | Out-Null
robocopy $skillsSrc $skillsDest /MIR /NFL /NDL /NJH /NJS /NC /NS | Out-Null

Write-Output "Synced rules to: $rulesDest"
Write-Output "Synced skills to: $skillsDest"
