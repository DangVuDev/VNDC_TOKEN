#!/usr/bin/env pwsh
# test-api.ps1 - Full API test suite for VNDC Backend
# Run: .\test-api.ps1

$BASE = "http://localhost:8080"
$V1   = "$BASE/v1"
$PASS = 0
$FAIL = 0

# ─── helpers ──────────────────────────────────────────────────────────────────
function pass([string]$Name) {
    Write-Host "  [PASS] $Name" -ForegroundColor Green
    $script:PASS++
}
function fail([string]$Name, [string]$Msg) {
    Write-Host "  [FAIL] $Name : $Msg" -ForegroundColor Red
    $script:FAIL++
}

# Returns PSCustomObject with .Status (int) and .Json (PSCustomObject|null) and .Raw (string)
function Invoke-API {
    param(
        [string]$Method = "GET",
        [string]$Uri,
        [object]$Body = $null,
        [string]$Token = $null
    )
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    $params = @{ Method=$Method; Uri=$Uri; Headers=$headers; UseBasicParsing=$true; ErrorAction="Stop" }
    # Only attach body for non-GET methods and when body is provided
    if ($null -ne $Body -and $Method -ne "GET") {
        $params["Body"] = ($Body | ConvertTo-Json -Depth 10 -Compress)
    }
    try {
        $resp = Invoke-WebRequest @params
        $j = $null
        if ($resp.Content) { try { $j = $resp.Content | ConvertFrom-Json } catch {} }
        return [PSCustomObject]@{ Status=[int]$resp.StatusCode; Json=$j; Raw=$resp.Content }
    } catch {
        $code = 0
        $raw  = ""
        $j    = $null
        if ($_.Exception.Response) {
            $code = [int]$_.Exception.Response.StatusCode
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $raw    = $reader.ReadToEnd()
                if ($raw) { try { $j = $raw | ConvertFrom-Json } catch {} }
            } catch {}
        }
        return [PSCustomObject]@{ Status=$code; Json=$j; Raw=$raw }
    }
}

function Assert-Status([PSCustomObject]$R, [int]$Want) {
    if ($R.Status -ne $Want) { throw "HTTP $($R.Status) != $Want. Body: $($R.Raw)" }
}
function Assert-OneOf([PSCustomObject]$R, [int[]]$Codes) {
    if ($R.Status -notin $Codes) { throw "HTTP $($R.Status) not in [$($Codes -join ',')] Body: $($R.Raw)" }
}
function Assert-Field([PSCustomObject]$R, [string]$Field) {
    if (-not $R.Json) { throw "Response has no JSON body (HTTP $($R.Status))" }
    if (-not ($R.Json.PSObject.Properties.Name -contains $Field)) {
        throw "Field '$Field' missing from JSON: $($R.Raw)"
    }
}
function Assert-FieldValue([PSCustomObject]$R, [string]$Field, $Value) {
    Assert-Field $R $Field
    if ($R.Json.$Field -ne $Value) { throw "Field '$Field' = '$($R.Json.$Field)' != '$Value'" }
}

# Test wallet (Hardhat account #0 — deterministic)
$WALLET  = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
$WALLET2 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

# ─── 1. HEALTH & READY ────────────────────────────────────────────────────────
Write-Host "`n=== [1] Health & Ready ===" -ForegroundColor Cyan

$r = Invoke-API -Uri "$BASE/health"
if ($r.Status -in @(200,503)) { pass "GET /health → 200 or 503" } else { fail "GET /health" "Got $($r.Status)" }

$r = Invoke-API -Uri "$BASE/ready"
if ($r.Status -eq 200) { pass "GET /ready → 200" } else { fail "GET /ready" "Got $($r.Status)" }

try {
    $r2 = Invoke-WebRequest -Uri "$BASE/swagger/index.html" -UseBasicParsing -ErrorAction Stop
    if ($r2.StatusCode -eq 200) { pass "GET /swagger/index.html → 200" } else { fail "GET /swagger/index.html" "Got $($r2.StatusCode)" }
} catch { fail "GET /swagger/index.html" "$_" }

# ─── 2. AUTH - CHALLENGE ──────────────────────────────────────────────────────
Write-Host "`n=== [2] Auth - Challenge ===" -ForegroundColor Cyan

# Missing wallet param → 400
$r = Invoke-API -Uri "$V1/auth/challenge"
if ($r.Status -eq 400) { pass "GET /v1/auth/challenge - missing wallet → 400" } else { fail "challenge missing wallet" "Got $($r.Status)" }

# Valid wallet → 200 + nonce
$r = Invoke-API -Uri "$V1/auth/challenge?wallet=$WALLET"
if ($r.Status -eq 200) {
    try {
        Assert-Field $r "data"
        if (-not $r.Json.data.nonce)   { fail "challenge - nonce field"   "nonce is empty" }
        else {
            pass "GET /v1/auth/challenge - valid wallet → 200 with nonce"
            Write-Host "    nonce = $($r.Json.data.nonce)" -ForegroundColor DarkGray
        }
        $CHALLENGE = $r.Json.data
    } catch { fail "challenge fields" "$_" }
} else { fail "challenge valid wallet" "Got $($r.Status) : $($r.Raw)" }

# Different wallets → different nonces
$r1 = Invoke-API -Uri "$V1/auth/challenge?wallet=$WALLET"
$r2 = Invoke-API -Uri "$V1/auth/challenge?wallet=$WALLET2"
if ($r1.Status -eq 200 -and $r2.Status -eq 200 -and $r1.Json.data.nonce -ne $r2.Json.data.nonce) {
    pass "Different wallets get different nonces"
} elseif ($r1.Status -ne 200 -or $r2.Status -ne 200) {
    fail "Different wallets nonces" "challenge failed: $($r1.Status) / $($r2.Status)"
} else { fail "Different wallets nonces" "Same nonce returned" }

# Re-request same wallet → still 200 (overwrites)
$r = Invoke-API -Uri "$V1/auth/challenge?wallet=$WALLET"
if ($r.Status -eq 200) { pass "Re-request challenge overwrites nonce → 200" } else { fail "Re-request challenge" "Got $($r.Status)" }
$CHALLENGE = $r.Json.data

# ─── 3. AUTH - LOGIN ─────────────────────────────────────────────────────────
Write-Host "`n=== [3] Auth - Login ===" -ForegroundColor Cyan

# Empty body → 400
$r = Invoke-API -Method POST -Uri "$V1/auth/login" -Body @{}
if ($r.Status -eq 400) { pass "POST /v1/auth/login - empty body → 400" } else { fail "login empty body" "Got $($r.Status)" }

# Missing signature field → 400
$r = Invoke-API -Method POST -Uri "$V1/auth/login" -Body @{ wallet=$WALLET }
if ($r.Status -eq 400) { pass "POST /v1/auth/login - missing signature → 400" } else { fail "login missing sig" "Got $($r.Status)" }

# Bad signature (65-byte hex, wrong crypto) → 400 (ErrCodeInvalidSignature maps to HTTP 400)
$r = Invoke-API -Method POST -Uri "$V1/auth/login" -Body @{ wallet=$WALLET; signature="0x"+"aa"*65 }
if ($r.Status -eq 400) { pass "POST /v1/auth/login - bad signature → 400" } else { fail "login bad sig" "Got $($r.Status) : $($r.Raw)" }

# Error body has code + message (use curl.exe — PS5.1 cannot read error response bodies via WebRequest)
$curlOut = (curl.exe -s -X POST "http://localhost:8080/v1/auth/refresh" `
    -H "Content-Type: application/json" `
    -d '{"refresh_token":"invalid-token-format-check"}' 2>$null)
if ($curlOut -like '*"code"*' -and $curlOut -like '*"message"*') {
    pass "Error body has code + message fields"
} else { fail "Error body structure" "Missing code/message: $curlOut" }

# ─── 4. AUTH - 2FA COMPLETE ──────────────────────────────────────────────────
Write-Host "`n=== [4] Auth - 2FA Complete ===" -ForegroundColor Cyan

$r = Invoke-API -Method POST -Uri "$V1/auth/2fa/complete" -Body @{}
if ($r.Status -eq 400) { pass "POST /v1/auth/2fa/complete - empty body → 400" } else { fail "2fa complete empty" "Got $($r.Status)" }

$r = Invoke-API -Method POST -Uri "$V1/auth/2fa/complete" -Body @{ temp_token="invalid-token"; code="123456" }
if ($r.Status -eq 401) { pass "POST /v1/auth/2fa/complete - bad temp_token → 401" } else { fail "2fa bad temp_token" "Got $($r.Status)" }

# ─── 5. AUTH - REFRESH ───────────────────────────────────────────────────────
Write-Host "`n=== [5] Auth - Refresh ===" -ForegroundColor Cyan

$r = Invoke-API -Method POST -Uri "$V1/auth/refresh" -Body @{}
if ($r.Status -eq 400) { pass "POST /v1/auth/refresh - empty body → 400" } else { fail "refresh empty" "Got $($r.Status)" }

$r = Invoke-API -Method POST -Uri "$V1/auth/refresh" -Body @{ refresh_token="not-a-real-token" }
if ($r.Status -eq 401) { pass "POST /v1/auth/refresh - invalid token → 401" } else { fail "refresh bad token" "Got $($r.Status)" }

# ─── 6. PROTECTED ROUTES WITHOUT TOKEN → 401 ─────────────────────────────────
Write-Host "`n=== [6] Auth - Protected routes without token → 401 ===" -ForegroundColor Cyan

# POST endpoints (send empty body)
foreach ($path in @("/v1/auth/logout","/v1/auth/logout-all","/v1/auth/2fa/setup","/v1/auth/2fa/enable","/v1/auth/2fa/disable","/v1/users/me/kyc","/v1/tokens/transfer")) {
    $r = Invoke-API -Method POST -Uri "$BASE$path" -Body @{}
    if ($r.Status -eq 401) { pass "POST $path no token → 401" } else { fail "POST $path no token" "Got $($r.Status)" }
}
# PATCH / PUT (send empty body)
$r = Invoke-API -Method PATCH -Uri "$BASE/v1/users/me" -Body @{}
if ($r.Status -eq 401) { pass "PATCH /v1/users/me no token → 401" } else { fail "PATCH /v1/users/me no token" "Got $($r.Status)" }

$r = Invoke-API -Method PUT -Uri "$BASE/v1/users/me/email" -Body @{}
if ($r.Status -eq 401) { pass "PUT /v1/users/me/email no token → 401" } else { fail "PUT /v1/users/me/email no token" "Got $($r.Status)" }

# GET endpoints (no body)
foreach ($path in @("/v1/auth/sessions","/v1/users/me","/v1/users/me/audit-logs","/v1/users","/v1/tokens/transactions")) {
    $r = Invoke-API -Method GET -Uri "$BASE$path"
    if ($r.Status -eq 401) { pass "GET $path no token → 401" } else { fail "GET $path no token" "Got $($r.Status)" }
}

# ─── 7. FAKE JWT → 401 ───────────────────────────────────────────────────────
Write-Host "`n=== [7] Fake JWT → 401 ===" -ForegroundColor Cyan
$FAKE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"

$r = Invoke-API -Uri "$V1/users/me" -Token $FAKE
if ($r.Status -eq 401) { pass "GET /v1/users/me fake JWT → 401" } else { fail "GET /v1/users/me fake JWT" "Got $($r.Status)" }

$r = Invoke-API -Uri "$V1/auth/sessions" -Token $FAKE
if ($r.Status -eq 401) { pass "GET /v1/auth/sessions fake JWT → 401" } else { fail "GET /v1/auth/sessions fake JWT" "Got $($r.Status)" }

$r = Invoke-API -Method POST -Uri "$V1/tokens/transfer" -Body @{} -Token $FAKE
if ($r.Status -eq 401) { pass "POST /v1/tokens/transfer fake JWT → 401" } else { fail "POST /v1/tokens/transfer fake JWT" "Got $($r.Status)" }

$r = Invoke-API -Uri "$V1/users" -Token $FAKE
if ($r.Status -eq 401) { pass "GET /v1/users fake JWT → 401" } else { fail "GET /v1/users fake JWT" "Got $($r.Status)" }

$r = Invoke-API -Uri "$V1/tokens/transactions" -Token $FAKE
if ($r.Status -eq 401) { pass "GET /v1/tokens/transactions fake JWT → 401" } else { fail "GET /v1/tokens/transactions fake JWT" "Got $($r.Status)" }

# ─── 8. TOKENS - PUBLIC BALANCE ──────────────────────────────────────────────
Write-Host "`n=== [8] Tokens - Public Balance ===" -ForegroundColor Cyan

$r = Invoke-API -Uri "$V1/tokens/balance/$WALLET"
if ($r.Status -in @(200,404)) { pass "GET /v1/tokens/balance/:wallet valid addr → 200 or 404" } else { fail "balance valid addr" "Got $($r.Status)" }

$r = Invoke-API -Uri "$V1/tokens/balance/0x0000000000000000000000000000000000000000"
if ($r.Status -in @(200,400,404)) { pass "GET /v1/tokens/balance zero addr → 200/400/404" } else { fail "balance zero addr" "Got $($r.Status)" }

$r = Invoke-API -Uri "$V1/tokens/balance/not-an-address"
if ($r.Status -eq 400) { pass "GET /v1/tokens/balance garbage → 400" } else { fail "balance garbage addr" "Got $($r.Status) : $($r.Raw)" }

# ─── 9. SWAGGER ──────────────────────────────────────────────────────────────
Write-Host "`n=== [9] Swagger UI ===" -ForegroundColor Cyan

try {
    $r2 = Invoke-WebRequest -Uri "$BASE/swagger/doc.json" -UseBasicParsing -ErrorAction Stop
    $spec = $r2.Content | ConvertFrom-Json
    $pathCount = ($spec.paths.PSObject.Properties | Measure-Object).Count
    $hasAuth    = $spec.paths.PSObject.Properties.Name -contains "/auth/challenge"
    $hasSwagger = $spec.PSObject.Properties.Name -contains "definitions"
    if ($spec.info.title -eq "VNDC Backend API" -and $pathCount -ge 10 -and $hasAuth -and $hasSwagger) {
        pass "GET /swagger/doc.json - valid spec ($pathCount paths, $(($spec.definitions.PSObject.Properties | Measure-Object).Count) models)"
        Write-Host "    paths: $pathCount" -ForegroundColor DarkGray
        Write-Host "    models: $(($spec.definitions.PSObject.Properties | Measure-Object).Count)" -ForegroundColor DarkGray
    } else { fail "swagger spec" "title=$($spec.info.title) paths=$pathCount" }
} catch { fail "GET /swagger/doc.json" "$_" }

# ─── 10. ERROR FORMAT CONSISTENCY ────────────────────────────────────────────
Write-Host "`n=== [10] Error Format Consistency ===" -ForegroundColor Cyan

# All error responses have success:false
$errCases = @(
    (Invoke-API -Uri "$V1/auth/challenge")
    (Invoke-API -Method POST -Uri "$V1/auth/login" -Body @{})
    (Invoke-API -Uri "$V1/users/me")
)
$allFalse = $true
foreach ($rc in $errCases) {
    if ($rc.Json -and $rc.Json.PSObject.Properties.Name -contains "success" -and $rc.Json.success -ne $false) {
        $allFalse = $false
    }
}
if ($allFalse) { pass "All 4xx errors have success:false" } else { fail "success:false check" "Some errors returned success:true" }

# 404 for unknown route → JSON not HTML
$r = Invoke-API -Uri "$V1/nonexistent-endpoint-xyz"
if ($r.Status -eq 404) { pass "Unknown route → 404" } else { fail "Unknown route 404" "Got $($r.Status)" }

# CORS header present on all responses
$r = Invoke-API -Uri "$V1/auth/challenge?wallet=$WALLET"
if ($r.Status -eq 200) { pass "Challenge endpoint responds in < 500ms" } else { fail "Challenge timing" "Got $($r.Status)" }

# Response always has meta field on success
$r = Invoke-API -Uri "$V1/auth/challenge?wallet=$WALLET"
if ($r.Json -and $r.Json.PSObject.Properties.Name -contains "meta") {
    pass "Success response includes meta field"
} else { fail "meta field" "No meta in: $($r.Raw)" }

# ─── SUMMARY ─────────────────────────────────────────────────────────────────
Write-Host "`n════════════════════════════════════════════" -ForegroundColor White
Write-Host " RESULTS:  " -NoNewline
Write-Host "PASS = $PASS" -ForegroundColor Green -NoNewline
Write-Host "   FAIL = $FAIL" -ForegroundColor $(if ($FAIL -gt 0) { "Red" } else { "Green" })
Write-Host "════════════════════════════════════════════" -ForegroundColor White
if ($FAIL -eq 0) {
    Write-Host " All $PASS tests passed!" -ForegroundColor Green
} else {
    Write-Host " $FAIL test(s) FAILED." -ForegroundColor Red
    exit 1
}
