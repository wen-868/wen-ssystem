# S3-234 证据装置：`backend/scripts/guard-migration-manifest.mjs` 的**绿侧 + 三例反测**。
#
# 为什么必须有反测（项目门禁铁律 2026-09-17）：
#   "步骤是 success" 不等于 "它能失败"。本脚本逐例**故意制造该门禁应当捕获的失败**，
#   并断言 EXIT=1、且失败信息**点名到具体文件**；复原后再断言 EXIT=0。
#   三例分别对应 guard 的三条判据：①新增迁移未登记 ②清单指向不存在的文件 ③清单少登记一个真实文件。
#
# 用法（仓库根执行）：
#   pwsh -File docs/evidence/S3-234/harness/run-guard-redtest.ps1
# 输出：控制台全文 + `docs/evidence/S3-234/raw/2x-*.txt`（每个用例独立落盘）
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
)

$ErrorActionPreference = 'Stop'
$guardRel = 'backend/scripts/guard-migration-manifest.mjs'
$manifestRel = 'deploy/migrations-manifest.txt'
$guard = Join-Path $RepoRoot $guardRel
$manifest = Join-Path $RepoRoot $manifestRel
$rawDir = Join-Path $RepoRoot 'docs/evidence/S3-234/raw'
New-Item -ItemType Directory -Force -Path $rawDir | Out-Null

# 期望值从**清单自身**算出来（不写死数字：清单将来加迁移时本装置不该误报）
$migCount = (Get-ChildItem -LiteralPath (Join-Path $RepoRoot 'docs/migrations') -Filter '*.sql').Count
$migLines = Get-Content -LiteralPath $manifest
$expActive = ($migLines | Where-Object { $_.Trim() -ne '' -and -not $_.StartsWith('#') }).Count
$expExempt = ($migLines | Where-Object { $_ -match '^#\s*EXEMPT\s*[:：]' }).Count
Write-Output "== 期望读数（由清单算出）：目录 .sql=$migCount｜活动段=$expActive｜豁免段=$expExempt"

$script:failures = @()

function Invoke-Guard {
  param([string[]]$ExtraArgs = @(), [string]$Label)
  $out = & node $guard @ExtraArgs 2>&1
  $rc = $LASTEXITCODE
  $text = ($out | Out-String)
  $file = Join-Path $rawDir "$Label.txt"
  [System.IO.File]::WriteAllText($file, "`$ node $guardRel $($ExtraArgs -join ' ')`r`n(exit=$rc)`r`n$text", (New-Object System.Text.UTF8Encoding($false)))
  return @{ rc = $rc; text = $text }
}

function Show-Guard {
  param($Result, [string]$Label)
  Write-Output "---- [$Label] exit=$($Result.rc) ----"
  Write-Output $Result.text.TrimEnd()
}

function Assert-Equal {
  param($Actual, $Expected, [string]$What)
  $ok = ($Actual -eq $Expected)
  Write-Output ("[{0}] {1}：实际={2}｜期望={3}" -f $(if ($ok) { 'PASS' } else { 'FAIL' }), $What, $Actual, $Expected)
  if (-not $ok) { $script:failures += "$What（实际=$Actual 期望=$Expected）" }
}

function Assert-Contains {
  param([string]$Haystack, [string]$Needle, [string]$What)
  $ok = $Haystack.Contains($Needle)
  Write-Output ("[{0}] {1}：需含「{2}」" -f $(if ($ok) { 'PASS' } else { 'FAIL' }), $What, $Needle)
  if (-not $ok) { $script:failures += "$What（未点名 $Needle）" }
}

Write-Output "== 仓库根：$RepoRoot"
Write-Output ("== guard 源文件 SHA256 = " + (Get-FileHash -LiteralPath $guard -Algorithm SHA256).Hash.Substring(0, 16))
Write-Output ("== 清单 SHA256        = " + (Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash.Substring(0, 16))

# ---------- 绿侧 ----------
$green = Invoke-Guard -Label '20-guard-green'
Show-Guard $green '20-guard-green'
Assert-Equal $green.rc 0 '绿侧：清单完整时 EXIT'
Assert-Contains $green.text 'PASS' '绿侧：输出含 PASS'

# ---------- 绿侧 · --json ----------
$jsonRaw = & node $guard --json 2>&1
$jsonRc = $LASTEXITCODE
$jsonFile = Join-Path $rawDir '20-guard-green.json'
[System.IO.File]::WriteAllText($jsonFile, ($jsonRaw | Out-String), (New-Object System.Text.UTF8Encoding($false)))
Assert-Equal $jsonRc 0 '绿侧：--json EXIT'
$jsonObj = ($jsonRaw | Out-String) | ConvertFrom-Json
Assert-Equal $jsonObj.ok $true '绿侧：--json ok 字段'
Assert-Equal $jsonObj.counts.migrationsInDir $migCount '绿侧：--json 迁移目录文件数'
Assert-Equal $jsonObj.counts.active $expActive '绿侧：--json 活动段行数'
Assert-Equal $jsonObj.counts.exempt $expExempt '绿侧：--json 豁免段行数'
# 豁免段与"破坏性文件"必须一一对应（本单唯一机械判据；豁免多了/少了都要在这里翻红）
$destructive = (Get-ChildItem -LiteralPath (Join-Path $RepoRoot 'docs/migrations') -Filter '*.sql' | Where-Object {
    (Get-Content -LiteralPath $_.FullName | Where-Object { $_ -match '^[ \t]*(DROP\s+TABLE|TRUNCATE|DELETE\s+FROM|DROP\s+DATABASE)\b' }).Count -gt 0
  } | Measure-Object).Count
Assert-Equal $expExempt $destructive '豁免段条数 == 含行首破坏性语句的迁移文件数'

# ---------- 反测 ①：新增迁移未登记 ----------
$fakeRel = 'docs/migrations/999_反测临时迁移_未登记.sql'
$fake = Join-Path $RepoRoot $fakeRel
[System.IO.File]::WriteAllText($fake, "-- S3-234 反测用临时文件（不进提交，跑完即删）`r`nSELECT 1 AS s3234_redtest;`r`n", (New-Object System.Text.UTF8Encoding($false)))
$red1 = Invoke-Guard -Label '21-guard-red-new-migration-unregistered'
Show-Guard $red1 '21-guard-red-new-migration-unregistered'
Assert-Equal $red1.rc 1 '反测①：未登记新迁移 ⇒ EXIT'
Assert-Contains $red1.text '999_反测临时迁移_未登记.sql' '反测①：点名到该文件'
Remove-Item -LiteralPath $fake -Force
$after1 = Invoke-Guard -Label '21b-guard-after-remove-fake'
Show-Guard $after1 '21b-guard-after-remove-fake'
Assert-Equal $after1.rc 0 '反测①：删掉临时文件后 ⇒ EXIT（复原）'

# ---------- 反测 ②：清单指向不存在的文件（scratch 根，不动工作树清单）----------
$scratch = Join-Path $env:TEMP 's3241-guard-scratch'
if (Test-Path $scratch) { Remove-Item -LiteralPath $scratch -Recurse -Force }
New-Item -ItemType Directory -Force -Path (Join-Path $scratch 'docs/migrations'), (Join-Path $scratch 'deploy'), (Join-Path $scratch 'backend/scripts') | Out-Null
Copy-Item -Path (Join-Path $RepoRoot 'docs/migrations/*.sql') -Destination (Join-Path $scratch 'docs/migrations') -Force
Copy-Item -LiteralPath $manifest -Destination (Join-Path $scratch $manifestRel) -Force
Copy-Item -LiteralPath $guard -Destination (Join-Path $scratch $guardRel) -Force
# scratch = 真清单 + 真语料 + 真 guard 的副本 ⇒ 只让「清单本身的一处改动」成为唯一变量，
# 这样判据②/③ 的红点不会被"语料缺失"这类无关噪声掩盖（判据①④的绿侧已在工作树真根上验过）
$scratchManifest = Join-Path $scratch $manifestRel
$origManifestText = [System.IO.File]::ReadAllText($scratchManifest)
[System.IO.File]::WriteAllText($scratchManifest, ($origManifestText.TrimEnd() + "`r`n999_不存在的迁移.sql`r`n"), (New-Object System.Text.UTF8Encoding($false)))
$red2 = Invoke-Guard -ExtraArgs @('--root', $scratch) -Label '22-guard-red-manifest-points-to-missing-file'
Show-Guard $red2 '22-guard-red-manifest-points-to-missing-file'
Assert-Equal $red2.rc 1 '反测②：清单里有不存在的文件 ⇒ EXIT'
Assert-Contains $red2.text '999_不存在的迁移.sql' '反测②：点名到该文件'

# ---------- 反测 ③：清单少登记一个**真实**迁移（scratch 同根，从原清单里删掉末行真实迁移）----------
#   注意：必须在 $origManifestText（未掺入 999 行的原清单）上删，否则删掉的是反测② 加进去的那行，
#   "删一行 ⇒ 应当红"的断言会被"刚好恢复到原状"骗过（本装置首跑就是这样翻车的，见 raw/23-*.txt 首版）。
$dropped = '204_系统设置域权限点立码.sql'
$kept = ([System.IO.File]::ReadAllLines($manifest)) | Where-Object { $_.Trim() -ne $dropped }
[System.IO.File]::WriteAllText($scratchManifest, (($kept -join "`r`n") + "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
Write-Output "== 反测③：从清单里删掉真实迁移行「$dropped」（该行即清单活动段最后一行）"
$red3 = Invoke-Guard -ExtraArgs @('--root', $scratch) -Label '23-guard-red-manifest-missing-real-file'
Show-Guard $red3 '23-guard-red-manifest-missing-real-file'
Assert-Equal $red3.rc 1 '反测③：真实文件未登记 ⇒ EXIT'
Assert-Contains $red3.text $dropped '反测③：点名到被删行的文件'

# ---------- 复原并复跑（scratch 恢复原清单 ⇒ 仍须 EXIT=0）----------
[System.IO.File]::WriteAllText($scratchManifest, $origManifestText, (New-Object System.Text.UTF8Encoding($false)))
$green2 = Invoke-Guard -ExtraArgs @('--root', $scratch) -Label '24-guard-restored-scratch'
Show-Guard $green2 '24-guard-restored-scratch'
Assert-Equal $green2.rc 0 '复原后（scratch）：EXIT'

# ---------- 工作树清单终态复核 ----------
$finalHash = (Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash
Write-Output ("== 工作树清单终态 SHA256 = " + $finalHash.Substring(0, 16))
$final = Invoke-Guard -Label '25-guard-final-green'
Show-Guard $final '25-guard-final-green'
Assert-Equal $final.rc 0 '终态：工作树清单 EXIT'

Write-Output ""
if ($script:failures.Count -gt 0) {
  Write-Output ("== 反测装置结论：FAIL（$(($script:failures | Measure-Object).Count) 处断言未过）")
  $script:failures | ForEach-Object { Write-Output "   - $_" }
  exit 1
}
Write-Output "== 反测装置结论：PASS（绿侧 1 例 + 反测 3 例，红绿两侧均达预期）"
exit 0
