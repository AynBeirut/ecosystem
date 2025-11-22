# Test emulator flow: wait for emulators, create auth user, seed Firestore, call /checkout
$authBase = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1'
$fsBase = 'http://127.0.0.1:8080/v1/projects/market-flow-7b074/databases/(default)/documents'
$funcUrl = 'http://127.0.0.1:5002/market-flow-7b074/us-central1/api/checkout'

Function Wait-UntilUp($url, $timeoutSec=60) {
  $end = (Get-Date).AddSeconds($timeoutSec)
  while((Get-Date) -lt $end) {
    try { $r = Invoke-WebRequest -Uri $url -UseBasicParsing -Method GET -TimeoutSec 3; return $true } catch { Start-Sleep -Seconds 1 }
  }
  return $false
}

Write-Host "Waiting for Auth emulator..."
if (-not (Wait-UntilUp "$authBase" 30)) { Write-Host "Auth emulator didn't respond"; exit 1 }
Write-Host "Auth up. Waiting for Firestore..."
if (-not (Wait-UntilUp "http://127.0.0.1:8080" 30)) { Write-Host "Firestore emulator didn't respond"; exit 1 }
Write-Host "Emulators available. Creating test user..."

$signupBody = @{email='test@example.com'; password='password'; returnSecureToken=$true} | ConvertTo-Json
$signup = Invoke-RestMethod -Method Post -Uri "$authBase/accounts:signUp?key=anything" -ContentType 'application/json' -Body $signupBody
$localId = $signup.localId
$idToken = $signup.idToken
Write-Host "Created user: $localId"

# Seed Firestore: users doc
$userDoc = @{ fields = @{ email = @{ stringValue = 'test@example.com' } } } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$fsBase/users/$localId" -ContentType 'application/json' -Body $userDoc | Out-Null
Write-Host "Seeded users/$localId"

# Create a store profile and a product
$storeId = 'store1'
$storeDoc = @{ fields = @{ name=@{stringValue='Test Store'}; usdToLbpRate=@{doubleValue='15000'} } } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$fsBase/storeProfiles/$storeId" -ContentType 'application/json' -Body $storeDoc | Out-Null
Write-Host "Seeded storeProfiles/$storeId"

$productId = 'prod1'
$productDoc = @{ fields = @{ storeId=@{stringValue=$storeId}; name=@{stringValue='Test Product'}; price=@{doubleValue='10'}; stock=@{integerValue='10'} } } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$fsBase/products/$productId" -ContentType 'application/json' -Body $productDoc | Out-Null
Write-Host "Seeded products/$productId"

# Prepare checkout payload
$body = @{ items = @(@{ productId = $productId; storeId = $storeId; price = 10; quantity = 1 }) } | ConvertTo-Json
Write-Host "Calling checkout function..."
try {
  $resp = Invoke-RestMethod -Method Post -Uri $funcUrl -ContentType 'application/json' -Body $body -Headers @{ Authorization = "Bearer $idToken" } -UseBasicParsing
  Write-Host "Function response:`n"; $resp | ConvertTo-Json -Depth 10
} catch {
  Write-Host "Function call failed:`n"; $_.Exception.Response | Format-List -Force
  exit 1
}

Write-Host "Smoke test complete."
