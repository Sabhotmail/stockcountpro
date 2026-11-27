# Express Stock Count Variance API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only ExpressAPI endpoint that returns STTAK3-style stock-count variance rows (`PhysicalBalance`, `LocationBalance`, `DifferentQty`) for a count date and one or more locations.

**Architecture:** Implement only inside the project copy at `external/ExpressAPI` (never edit the OneDrive source). Add a pure validation/diff helper tested with a small PowerShell assert script, an OleDb reader that loads filtered `STTAK` then joins `STLOC`/`STMAS` in memory, and a Pode GET route wired like existing `routes/*.ps1` modules. Phase 2 StockCount Pro UI/proxy is out of scope.

**Tech Stack:** PowerShell 5.1+, Pode 2.12.1 (vendored under `external/ExpressAPI/libs`), VFPOLEDB against Express company DBF path from `Config.ini`, PSSQLite for auth tokens (existing).

## Global Constraints

- Edit only `external/ExpressAPI/**` (and this plan/docs); do not modify OneDrive `ExpressAPI_Deploy` originals.
- Endpoint path must be exactly: `GET /api/stockcount/variance/countdate/{yyyy-MM-dd}/locations/{codes}`.
- Formula must be exactly: `DifferentQty = PhysicalBalance - LocationBalance` where `PhysicalBalance = STTAK.PHYBAL` and `LocationBalance = STLOC.LOCBAL` (live).
- Include only rows with `TAKFLG` equal to `'2'` or `'3'`.
- Missing `STLOC` row: still return the STTAK line with `LocationBalance = $null` and `DifferentQty = $null`.
- Empty result after filters: HTTP 404 with message `Variance data not found`.
- Location codes: trim, uppercase, allow only `[A-Z0-9]+`, reject empty list; join with literal commas in path (do not require clients to send `%2C`).
- Auth: same Bearer + `Get-CurrentUser` pattern as `routes/armas.ps1`.
- Do not implement dual-unit STTAKD, post/adjust, STTAKX, or StockCount Pro Next.js proxy/UI in this plan.

## File map

| File | Responsibility |
|------|----------------|
| `external/ExpressAPI/helpers/express-stockcount-variance-helper.ps1` | Parse/validate inputs; compute diff; OleDb load + in-memory join |
| `external/ExpressAPI/helpers/express-stockcount-variance-helper.Tests.ps1` | Assert script for pure functions (no DBF required) |
| `external/ExpressAPI/routes/stockcount-variance.ps1` | Pode route, auth, status codes, JSON shape |
| `external/ExpressAPI/ExpressAPI.ps1` | `Use-PodeScript` helper + dot-source route |
| `external/ExpressAPI/API_ENDPOINTS.md` | Document the new endpoint |

---

### Task 1: Pure validation + difference helpers (TDD)

**Files:**
- Create: `external/ExpressAPI/helpers/express-stockcount-variance-helper.ps1`
- Create: `external/ExpressAPI/helpers/express-stockcount-variance-helper.Tests.ps1`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `Test-ExpressVarianceCountDate([string]$CountDate) -> [bool]` — true only for `^\d{4}-\d{2}-\d{2}$`
  - `ConvertTo-ExpressVarianceLocationCodes([string]$LocationsPathSegment) -> [pscustomobject]` with either `{ Ok = $true; Codes = [string[]] }` or `{ Ok = $false; Error = [string] }`
  - `Get-ExpressVarianceDifferentQty([nullable[decimal]]$PhysicalBalance, [nullable[decimal]]$LocationBalance) -> [nullable[decimal]]` — returns `$null` if either side is `$null`; else `PhysicalBalance - LocationBalance`

- [ ] **Step 1: Write the failing test script**

Create `external/ExpressAPI/helpers/express-stockcount-variance-helper.Tests.ps1`:

```powershell
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\express-stockcount-variance-helper.ps1"

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "ASSERT FAIL: $Message" }
}

Assert-True (Test-ExpressVarianceCountDate '2026-03-11') 'valid date'
Assert-True (-not (Test-ExpressVarianceCountDate '2026/03/11')) 'slash date invalid'
Assert-True (-not (Test-ExpressVarianceCountDate '26-03-11')) 'short year invalid'

$ok = ConvertTo-ExpressVarianceLocationCodes '24a1, 24GA'
Assert-True $ok.Ok 'locations ok'
Assert-True (@($ok.Codes) -join ',' -eq '24A1,24GA') 'normalized codes'

$bad = ConvertTo-ExpressVarianceLocationCodes '24A1/../X'
Assert-True (-not $bad.Ok) 'reject traversal-like code'

$empty = ConvertTo-ExpressVarianceLocationCodes '  ,  '
Assert-True (-not $empty.Ok) 'reject empty'

Assert-True ((Get-ExpressVarianceDifferentQty 3648 3600) -eq 48) 'positive diff'
Assert-True ((Get-ExpressVarianceDifferentQty 10 12) -eq -2) 'negative diff'
Assert-True ($null -eq (Get-ExpressVarianceDifferentQty 10 $null)) 'null locbal'
Assert-True ($null -eq (Get-ExpressVarianceDifferentQty $null 10)) 'null phybal'

Write-Host 'express-stockcount-variance-helper.Tests: OK'
```

- [ ] **Step 2: Run tests — expect fail (helper missing)**

Run:

```powershell
powershell -NoProfile -File "external\ExpressAPI\helpers\express-stockcount-variance-helper.Tests.ps1"
```

Expected: error that `express-stockcount-variance-helper.ps1` cannot be dot-sourced / command not found.

- [ ] **Step 3: Implement pure helpers only**

Create `external/ExpressAPI/helpers/express-stockcount-variance-helper.ps1` with at least:

```powershell
function Test-ExpressVarianceCountDate {
    param([Parameter(Mandatory = $true)][string]$CountDate)
    return [bool]($CountDate -match '^\d{4}-\d{2}-\d{2}$')
}

function ConvertTo-ExpressVarianceLocationCodes {
    param([Parameter(Mandatory = $true)][string]$LocationsPathSegment)
    $normalized = New-Object System.Collections.Generic.List[string]
    foreach ($raw in ($LocationsPathSegment -split ',')) {
        $code = $raw.Trim().ToUpperInvariant()
        if ([string]::IsNullOrWhiteSpace($code)) { continue }
        if ($code -notmatch '^[A-Z0-9]+$') {
            return [pscustomobject]@{ Ok = $false; Error = "Invalid location code: $($raw.Trim())"; Codes = @() }
        }
        [void]$normalized.Add($code)
    }
    if ($normalized.Count -eq 0) {
        return [pscustomobject]@{ Ok = $false; Error = 'Invalid locations'; Codes = @() }
    }
    return [pscustomobject]@{ Ok = $true; Error = $null; Codes = @($normalized.ToArray()) }
}

function Get-ExpressVarianceDifferentQty {
    param(
        [Nullable[decimal]]$PhysicalBalance,
        [Nullable[decimal]]$LocationBalance
    )
    if ($null -eq $PhysicalBalance -or $null -eq $LocationBalance) { return $null }
    return [decimal]$PhysicalBalance - [decimal]$LocationBalance
}
```

Do not add OleDb functions yet in this step if you prefer a smaller commit; adding empty stubs is fine as long as tests pass.

- [ ] **Step 4: Re-run tests — expect pass**

Run the same command as Step 2.

Expected: `express-stockcount-variance-helper.Tests: OK`

- [ ] **Step 5: Commit**

```bash
git add external/ExpressAPI/helpers/express-stockcount-variance-helper.ps1 external/ExpressAPI/helpers/express-stockcount-variance-helper.Tests.ps1
git commit -m "Add variance helper validation and difference math with tests."
```

---

### Task 2: OleDb reader + in-memory join

**Files:**
- Modify: `external/ExpressAPI/helpers/express-stockcount-variance-helper.ps1`

**Interfaces:**
- Consumes: `Test-ExpressVarianceCountDate`, `ConvertTo-ExpressVarianceLocationCodes`, `Get-ExpressVarianceDifferentQty` from Task 1
- Produces: `Get-ExpressStockCountVarianceData -fullPathToDBF [string] -CountDate [string] -LocationCodes [string[]] -> [System.Collections.ArrayList]` of row objects with properties: `LocationCode`, `ProductCode`, `ProductName`, `Area`, `CountDate`, `PhysicalBalance`, `LocationBalance`, `DifferentQty`, `CountFlag` (empty list if none; never `$null` for “not found” — route maps empty → 404)

- [ ] **Step 1: Add `Get-ExpressStockCountVarianceData`**

Append to the helper (follow OleDb open/close style from `helpers/express-stocktransfer-helper.ps1`):

1. Open VFPOLEDB connection to `$fullPathToDBF`.
2. `USE STTAK.dbf INDEX STTAK.cdx;`
3. Query STTAK where `DTOS(TAKDAT) = ?` (pass `CountDate` with dashes removed, e.g. `20260311`), `(TAKFLG = '2' OR TAKFLG = '3')`, and `LOCCOD` in the requested codes (build `IN (?,?,...)` with one parameter per code — do not concatenate untrusted SQL strings for codes beyond parameterized values).
4. Select at least: `LOCCOD`, `STKCOD`, `AREA`, `TAKDAT`, `PHYBAL`, `TAKFLG`.
5. Close reader; then `USE STLOC.dbf INDEX STLOC.cdx;` and load balances for the same location codes into a hashtable keyed by `"$STKCOD|$LOCCOD"` → `{ LOCBAL; AREA }`.
6. `USE STMAS.dbf INDEX STMAS.cdx;` and load `STKCOD → STKDES` for product codes seen in STTAK rows (or load names on demand if simpler and dataset is small).
7. For each STTAK row, build:

```powershell
$locKey = "$stkCod|$locCod"
$loc = $stlocMap[$locKey]
$phy = [decimal]$phyBal
$locBal = if ($null -eq $loc) { $null } else { [decimal]$loc.LOCBAL }
$area = if ($loc -and $loc.AREA) { $loc.AREA } else { $takArea }
[pscustomobject]@{
    LocationCode     = $locCod
    ProductCode      = $stkCod
    ProductName      = $(if ($stmasMap.ContainsKey($stkCod)) { $stmasMap[$stkCod] } else { '' })
    Area             = $area
    CountDate        = $CountDate
    PhysicalBalance  = $phy
    LocationBalance  = $locBal
    DifferentQty     = (Get-ExpressVarianceDifferentQty $phy $locBal)
    CountFlag        = $takFlg
}
```

8. Always close readers/connection in `finally`.
9. Return `ArrayList` (possibly empty).

If VFPOLEDB rejects `DTOS`, fall back to `{^yyyy-MM-dd}` date literal **only** after validating `Test-ExpressVarianceCountDate` is true (safe to interpolate validated digits).

- [ ] **Step 2: Smoke-test against a real company folder (manual)**

With `Config.ini` `ExpressDbPath` pointing at a company that has STTAK rows (example historically: `\\express-hq\Express\ExpressI\Z32TPNL` or `110HQ68`), run in PowerShell:

```powershell
. .\external\ExpressAPI\helpers\express-stockcount-variance-helper.ps1
$path = (Get-Content .\external\ExpressAPI\Config.ini | Where-Object { $_ -match '^ExpressDbPath=' }) -replace '^ExpressDbPath=',''
# Override $path to a known folder with STTAK if Config points elsewhere
$rows = Get-ExpressStockCountVarianceData -fullPathToDBF $path -CountDate 'YYYY-MM-DD' -LocationCodes @('XXXX')
$rows | Select-Object -First 5 | Format-Table
```

Expected: rows with numeric `PhysicalBalance` / `LocationBalance` / `DifferentQty`, or empty list if date/location wrong.

Pick one SKU and confirm `DifferentQty` equals PHYBAL − LOCBAL by hand.

- [ ] **Step 3: Re-run Task 1 unit tests**

Run:

```powershell
powershell -NoProfile -File "external\ExpressAPI\helpers\express-stockcount-variance-helper.Tests.ps1"
```

Expected: OK

- [ ] **Step 4: Commit**

```bash
git add external/ExpressAPI/helpers/express-stockcount-variance-helper.ps1
git commit -m "Load STTAK variance rows joined to live STLOC balances."
```

---

### Task 3: Pode route + wire into server + docs

**Files:**
- Create: `external/ExpressAPI/routes/stockcount-variance.ps1`
- Modify: `external/ExpressAPI/ExpressAPI.ps1` (add `Use-PodeScript` for helper near other helpers; add `. "$currentPath\routes\stockcount-variance.ps1"` near other routes)
- Modify: `external/ExpressAPI/API_ENDPOINTS.md`

**Interfaces:**
- Consumes: `Get-CurrentUser`, `Get-ExpressStockCountVarianceData`, `Test-ExpressVarianceCountDate`, `ConvertTo-ExpressVarianceLocationCodes`
- Produces: HTTP JSON as in the design spec

- [ ] **Step 1: Create the route file**

`external/ExpressAPI/routes/stockcount-variance.ps1`:

```powershell
Add-PodeRoute -Method Get -Path ('/' + $prefixPath + '/stockcount/variance/countdate/:countdate/locations/:locations') -ScriptBlock {
    $dbPath = Get-PodeState -Name 'DbPath'
    $currentUser = Get-CurrentUser -WebEvent $WebEvent -DbPath $dbPath
    if (!$currentUser) {
        Write-PodeJsonResponse -StatusCode 401 -Value @{ success = $false; message = 'Unauthorized' }
        return
    }
    if ($currentUser.expire -lt (Get-Date)) {
        Write-PodeJsonResponse -StatusCode 401 -Value @{ success = $false; message = 'Token Expired' }
        return
    }

    $countDate = $WebEvent.Parameters['countdate']
    if (-not (Test-ExpressVarianceCountDate -CountDate $countDate)) {
        Write-PodeJsonResponse -StatusCode 400 -Value @{ success = $false; message = 'Invalid countDate' }
        return
    }

    $locParse = ConvertTo-ExpressVarianceLocationCodes -LocationsPathSegment $WebEvent.Parameters['locations']
    if (-not $locParse.Ok) {
        Write-PodeJsonResponse -StatusCode 400 -Value @{ success = $false; message = 'Invalid locations' }
        return
    }

    try {
        $expressDbPath = Get-PodeState -Name 'ExpressDbPath'
        $rows = Get-ExpressStockCountVarianceData -fullPathToDBF $expressDbPath -CountDate $countDate -LocationCodes $locParse.Codes
    }
    catch {
        Write-PodeJsonResponse -StatusCode 500 -Value @{ success = $false; message = 'Internal error' }
        return
    }

    if ($null -eq $rows) {
        Write-PodeJsonResponse -StatusCode 500 -Value @{ success = $false; message = 'Internal error' }
        return
    }
    if (($rows.GetType().Name) -eq 'PSCustomObject') {
        $one = $rows
        $rows = New-Object System.Collections.ArrayList
        [void]$rows.Add($one)
    }
    if ($rows.Count -eq 0) {
        Write-PodeJsonResponse -StatusCode 404 -Value @{ success = $false; message = 'Variance data not found' }
        return
    }

    Write-PodeJsonResponse -StatusCode 200 -Value @{
        success      = $true
        countDate    = $countDate
        locations    = @($locParse.Codes)
        varianceData = @($rows)
    }
}
```

- [ ] **Step 2: Wire `ExpressAPI.ps1`**

Inside `Start-PodeServer`, with other helpers:

```powershell
Use-PodeScript -Path "$currentPath\helpers\express-stockcount-variance-helper.ps1"
```

With other routes (e.g. after stocktransfer):

```powershell
. "$currentPath\routes\stockcount-variance.ps1"
```

- [ ] **Step 3: Update `API_ENDPOINTS.md`**

Add a table row, e.g. next free number:

`GET | `/api/stockcount/variance/countdate/:countdate/locations/:locations` | Stock count variance (STTAK vs STLOC) | ✅ | ❌`

Also add under Route Files: `routes/stockcount-variance.ps1`.

- [ ] **Step 4: Manual HTTP test**

1. Start API from `external/ExpressAPI` (`ExpressAPI.bat` or `ExpressAPI.ps1`) with `ExpressDbPath` set to a company folder that has STTAK data.
2. Login:

```powershell
$login = Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/api/login' -ContentType 'application/json' -Body '{"username":"admin","password":"..."}'
$token = $login.token
```

3. Call variance (adjust date/locations):

```powershell
$h = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Headers $h -Uri 'http://localhost:8080/api/stockcount/variance/countdate/2026-03-11/locations/24A1'
```

Expected: `success=true` and `varianceData` array, or 404 if no data.

Also verify: bad date → 400; no auth → 401; unknown location/date → 404.

- [ ] **Step 5: Commit**

```bash
git add external/ExpressAPI/routes/stockcount-variance.ps1 external/ExpressAPI/ExpressAPI.ps1 external/ExpressAPI/API_ENDPOINTS.md
git commit -m "Expose stock-count variance endpoint matching STTAK3 formula."
```

If `external/ExpressAPI` is still largely untracked, include the minimal set required to run the new route (helpers, routes, ExpressAPI.ps1, Config.ini.example if any, API_ENDPOINTS.md). Prefer not force-adding `tokens.db`. Pode `libs/` may be added if the copy is meant to be self-contained; if the commit is too large, add `libs/` in a separate commit titled for vendoring Pode/PSSQLite.

---

### Task 4: Spec checklist pass + handoff note

**Files:**
- None required (optional short note in plan checkbox only)

- [ ] **Step 1: Run unit tests again**

```powershell
powershell -NoProfile -File "external\ExpressAPI\helpers\express-stockcount-variance-helper.Tests.ps1"
```

Expected: OK

- [ ] **Step 2: Tick design test checklist**

Confirm against `docs/superpowers/specs/2026-11-27-express-stockcount-variance-api-design.html`:

- Auth required
- Date/location validation
- TAKFLG 2|3 only
- Formula PHYBAL − LOCBAL
- Missing STLOC → null balances/diff
- 404 when empty
- No edits under OneDrive ExpressAPI_Deploy

- [ ] **Step 3: Commit any doc fixes only if needed; push**

```bash
git status
git push origin HEAD
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| GET variance endpoint path | Task 3 |
| Auth Bearer / 401 | Task 3 |
| Invalid date/locations → 400 | Tasks 1 + 3 |
| TAKFLG 2\|3 filter | Task 2 |
| PHYBAL − LOCBAL formula | Tasks 1 + 2 |
| Missing STLOC → null LocationBalance/DifferentQty | Task 2 |
| Empty → 404 | Task 3 |
| Files only under `external/ExpressAPI` | Global + all tasks |
| No Phase 2 UI/proxy | Global Constraints |
| API_ENDPOINTS.md update | Task 3 |
| Unit tests for validation/diff | Task 1 |

## Placeholder scan

No TBD/TODO left in task steps; OleDb date filter has an explicit validated fallback if `DTOS` fails.
