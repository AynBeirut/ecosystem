$authBase = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1'
$fsBase = 'http://127.0.0.1:8080/v1/projects/market-flow-7b074/databases/(default)/documents'

Write-Host "Starting emulator follow test..."

$signupBody = @{email='test@example.com'; password='password'; returnSecureToken=$true} | ConvertTo-Json
try {
  $signup = Invoke-RestMethod -Method Post -Uri "$authBase/accounts:signUp?key=anything" -ContentType 'application/json' -Body $signupBody -TimeoutSec 10
} catch {
  Write-Host "Sign-up failed:"; Write-Host $_.Exception.Response.Content; exit 2
}
$localId = $signup.localId
$idToken = $signup.idToken
Write-Host "Created user: $localId"

$userDoc = @{ fields = @{ email = @{ stringValue = 'test@example.com' } } } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$fsBase/users/$localId" -ContentType 'application/json' -Body $userDoc | Out-Null
Write-Host "Seeded users/$localId"

$followDoc = @{ fields = @{ followedAt = @{ stringValue = (Get-Date).ToString('o') } } } | ConvertTo-Json
try {
  Invoke-RestMethod -Method Patch -Uri "$fsBase/users/$localId/follows/test-follow" -ContentType 'application/json' -Body $followDoc -Headers @{ Authorization = "Bearer $idToken" } -UseBasicParsing -TimeoutSec 10
  Write-Host "Follow doc created"
} catch {
  Write-Host "Follow write failed"
  if ($_.Exception -and $_.Exception.Response) {
    try { Write-Host $_.Exception.Response.Content } catch { Write-Host $_ }
  } else { Write-Host $_ }
  exit 1
}

Write-Host "Emulator follow test finished successfully."