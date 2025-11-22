# Smoke test for /checkout against local emulators
# Run after starting the emulators from the repo root:
# npx firebase emulators:start --only functions,firestore,auth

$projectId = "demo-project"
$functionsPort = 5002
$firestorePort = 8080
$authPort = 9099

$functionsUrl = "http://127.0.0.1:$functionsPort/$projectId/us-central1/api/checkout"
$authSignUpUrl = "http://127.0.0.1:$authPort/identitytoolkit.googleapis.com/v1/accounts:signUp?key=any"
$fsBase = "http://127.0.0.1:$firestorePort/v1/projects/$projectId/databases/(default)/documents"

Write-Host "Functions endpoint: $functionsUrl"
Write-Host "Firestore REST base: $fsBase"
Write-Host "Auth sign-up endpoint: $authSignUpUrl"

# 1) Create a test user in Auth emulator and get idToken
$signupBody = @{
  email = "smoke+test@example.com"
  password = "password123"
  returnSecureToken = $true
} | ConvertTo-Json

$resp = Invoke-RestMethod -Method Post -Uri $authSignUpUrl -Body $signupBody -ContentType 'application/json'
$token = $resp.idToken
$uid = $resp.localId
Write-Host "Created test user uid=$uid"

# 2) Seed Firestore: products/prod-1
$productDoc = @{
  fields = @{
    price = @{ doubleValue = 10 }
    stock = @{ integerValue = 100 }
    inStock = @{ booleanValue = $true }
    storeId = @{ stringValue = "store-1" }
    title = @{ stringValue = "Smoke Test Product" }
  }
} | ConvertTo-Json -Depth 6

Invoke-RestMethod -Method Patch -Uri "$fsBase/products/prod-1" -Body $productDoc -ContentType 'application/json'
Write-Host "Seeded product: products/prod-1"

# 3) Seed storeProfiles/store-1
$storeProfile = @{
  fields = @{
    usdToLbpRate = @{ doubleValue = 15000 }
  }
} | ConvertTo-Json -Depth 6

Invoke-RestMethod -Method Patch -Uri "$fsBase/storeProfiles/store-1" -Body $storeProfile -ContentType 'application/json'
Write-Host "Seeded store profile: storeProfiles/store-1"

# 4) Ensure user document exists with some credits
$userDoc = @{
  fields = @{
    credits = @{ integerValue = 1000 }
    email = @{ stringValue = "smoke+test@example.com" }
  }
} | ConvertTo-Json -Depth 6

Invoke-RestMethod -Method Patch -Uri "$fsBase/users/$uid" -Body $userDoc -ContentType 'application/json'
Write-Host "Seeded user doc: users/$uid with credits"

# 5) POST /checkout calling the local function
$payload = @{
  items = @(
    @{ productId = "prod-1"; storeId = "store-1"; quantity = 2 }
  )
} | ConvertTo-Json -Depth 6

Write-Host "Calling /checkout..."
try {
  $checkoutResp = Invoke-RestMethod -Method Post -Uri $functionsUrl -Headers @{ Authorization = "Bearer $token" } -Body $payload -ContentType 'application/json' -ErrorAction Stop
  Write-Host "Checkout response:"
  $checkoutResp | ConvertTo-Json -Depth 5
} catch {
  Write-Host "Function call failed:"
  $_.Exception.Response | Format-List -Force
  throw
}

# 6) Read back 'orders' and 'creditTransactions' collections to verify writes
Write-Host "Listing created orders (Firestore REST):"
$ordersList = Invoke-RestMethod -Method Get -Uri "$fsBase/orders?pageSize=20" -ContentType 'application/json'
$ordersList | ConvertTo-Json -Depth 6


# 7) Read product stock and user credits after transaction:
$productAfter = Invoke-RestMethod -Method Get -Uri "$fsBase/products/prod-1" -ContentType 'application/json'
$userAfter = Invoke-RestMethod -Method Get -Uri "$fsBase/users/$uid" -ContentType 'application/json'
Write-Host "Product after transaction:"
$productAfter | ConvertTo-Json -Depth 6
Write-Host "User doc after transaction:"
$userAfter | ConvertTo-Json -Depth 6

Write-Host "Smoke test finished."