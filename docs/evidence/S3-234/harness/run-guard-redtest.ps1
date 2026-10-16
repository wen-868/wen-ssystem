# S3-234 证据装置（**R1 返工版 v2**）：`backend/scripts/guard-migration-manifest.mjs` 的**绿侧 + 八例反测**。
#
# 为什么必须有反测（项目门禁铁律 2026-09-17）：
#   "步骤是 success" 不等于 "它能失败"。本脚本逐例**故意制造该门禁应当捕获的失败**，
#   并断言 EXIT=1、且失败信息**点名到具体文件**；复原后再断言 EXIT=0。
#
# v2 与 v1 的差别（R1 返工：三通道）：
#   · 期望读数由「活动段 / 豁免段」两列扩为**三列**（A 活动段 / C 豁免段 / B 登记册），并断言三者之和 = 目录 .sql 数；
#   · 新增 4 例**登记册反测**：④登记册少一条真实文件 ⑤登记册行格式不合法 ⑥同一文件既在活动段又在登记册（自相矛盾）
#     ⑦登记册指向不存在的文件 —— 判据"有"和判据"能红"是两件事，后者必须逐例证；
#   · 输出文件名换前缀（默认 `80-`），**不覆盖** s3241 那一轮的 `20~26-*.txt` 历史证据。
#
# 反测一律"**先注违规 → 验红并点名 → 复原（SHA256 比对）→ 验绿**"；用 scratch 根做改造，
#   只在反测①（新增未登记迁移）时往工作树放一个临时文件并立刻删除（工作树清单/登记册全程不改）。
#
# 用法（仓库根执行）：
#   pwsh -File docs/evidence/S3-234/harness/run-guard-redtest.ps1 [-Prefix 80]
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path,
  [string]$Prefix = '80'
)

$ErrorActionPreference = 'Stop'
$guardRel = 'backend/scripts/guard-migration-manifest.mjs'
$manifestRel = 'deploy/migrations-manifest.txt'
$registryRel = 'deploy/migrations-nonidempotent-registry.txt'
$guard = Join-Path $RepoRoot $guardRel
$manifest = Join-Path $RepoRoot $manifestRel
$registry = Join-Path $RepoRoot $registryRel
$rawDir = Join-Path $RepoRoot 'docs/evidence/S3-234/raw'
New-Item -ItemType Directory -Force -Path $rawDir | Out-Null

# 期望值从**清单/登记册自身**算出来（不写死数字：将来加迁移时本装置不该误报）
$migCount = (Get-ChildItem -LiteralPath (Join-Path $RepoRoot 'docs/migrations') -Filter '*.sql').Count
$migLines = Get-Content -LiteralPath $manifest
$expActive = ($migLines | Where-Object { $_.Trim() -ne '' -and -not $_.StartsWith('#') }).Count
$expExempt = ($migLines | Where-Object { $_ -match '^#\s*EXEMPT\s*[:：]' }).Count
$regLines = Get-Content -LiteralPath $registry | Where-Object { $_.Trim() -ne '' -and -not $_.Trim().StartsWith('#') }
$expRegistry = $regLines.Count
Write-Output "== 期望读数（由清单/登记册算出）：目录 .sql=$migCount｜A 活动段=$expActive｜C 豁免段=$expExempt｜B 登记册=$expRegistry"

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
Write-Output ("== 清单 SHA256         = " + (Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash.Substring(0, 16))
Write-Output ("== 登记册 SHA256       = " + (Get-FileHash -LiteralPath $registry -Algorithm SHA256).Hash.Substring(0, 16))

# ---------- 绿侧 ----------
$green = Invoke-Guard -Label "$($Prefix)-guard-green"
Show-Guard $green "$($Prefix)-guard-green"
Assert-Equal $green.rc 0 '绿侧：三通道登记完整时 EXIT'
Assert-Contains $green.text 'PASS' '绿侧：输出含 PASS'

# ---------- 绿侧 · --json + 三通道计数与守恒 ----------
$jsonRaw = & node $guard --json 2>&1
$jsonRc = $LASTEXITCODE
$jsonFile = Join-Path $rawDir "$($Prefix)-guard-green.json"
[System.IO.File]::WriteAllText($jsonFile, ($jsonRaw | Out-String), (New-Object System.Text.UTF8Encoding($false)))
Assert-Equal $jsonRc 0 '绿侧：--json EXIT'
$jsonObj = ($jsonRaw | Out-String) | ConvertFrom-Json
Assert-Equal $jsonObj.ok $true '绿侧：--json ok 字段'
Assert-Equal $jsonObj.counts.migrationsInDir $migCount '绿侧：--json 迁移目录文件数'
Assert-Equal $jsonObj.counts.active $expActive '绿侧：--json A 活动段行数'
Assert-Equal $jsonObj.counts.exempt $expExempt '绿侧：--json C 豁免段行数'
Assert-Equal $jsonObj.counts.registry $expRegistry '绿侧：--json B 登记册行数'
Assert-Equal ($jsonObj.counts.active + $jsonObj.counts.exempt + $jsonObj.counts.registry) $migCount '绿侧：三分类之和 == 目录 .sql 数'

# 豁免段 = 含行首破坏性语句的文件 + 人工判定的"口令类种子"（本单 1 条：075）
$destructiveFiles = @(Get-ChildItem -LiteralPath (Join-Path $RepoRoot 'docs/migrations') -Filter '*.sql' | Where-Object {
    (Get-Content -LiteralPath $_.FullName | Where-Object { $_ -match '^[ \t]*(DROP\s+TABLE|TRUNCATE|DELETE\s+FROM|DROP\s+DATABASE)\b' }).Count -gt 0
  } | ForEach-Object { $_.Name })
$exemptFiles = @($migLines | Where-Object { $_ -match '^#\s*EXEMPT\s*[:：]' } | ForEach-Object {
    $name = ($_ -replace '^#\s*EXEMPT\s*[:：]\s*', '')
    $name = ($name -split '\s*——\s*')[0]
    $name = ($name -split '\s*--\s*')[0]
    $name.Trim()
  })
$manualExempt = @($exemptFiles | Where-Object { $destructiveFiles -notcontains $_ })
Assert-Equal ($destructiveFiles | Measure-Object).Count ($expExempt - $manualExempt.Count) '豁免段里"破坏性语句"类条数 == 含行首破坏性语句的文件数'
Assert-Equal (($manualExempt -join ',')) '075_reset_admin_password_bcrypt.sql' '豁免段里"人工判定"类文件 == 075（口令类种子）'

# ---------- 反测 ①：新增迁移三条通道都没登记 ----------
$fakeRel = 'docs/migrations/999_反测临时迁移_未登记.sql'
$fake = Join-Path $RepoRoot $fakeRel
[System.IO.File]::WriteAllText($fake, "-- S3-234 反测用临时文件（不进提交，跑完即删）`r`nSELECT 1 AS s3234_redtest;`r`n", (New-Object System.Text.UTF8Encoding($false)))
$red1 = Invoke-Guard -Label "$($Prefix)-guard-red-new-migration-unregistered"
Show-Guard $red1 "$($Prefix)-guard-red-new-migration-unregistered"
Assert-Equal $red1.rc 1 '反测①：未登记新迁移 ⇒ EXIT'
Assert-Contains $red1.text '999_反测临时迁移_未登记.sql' '反测①：点名到该文件'
Remove-Item -LiteralPath $fake -Force
$after1 = Invoke-Guard -Label "$($Prefix)b-guard-after-remove-fake"
Show-Guard $after1 "$($Prefix)b-guard-after-remove-fake"
Assert-Equal $after1.rc 0 '反测①：删掉临时文件后 ⇒ EXIT（复原）'

# ---------- scratch 根：真语料 + 真清单 + 真登记册 + 真 guard 的副本 ----------
#   scratch = 真件副本 ⇒ 每次只让「被改造的那一处」成为唯一变量，红点不会被"语料缺失"这类无关噪声掩盖
$scratch = Join-Path $env:TEMP 's3243-guard-scratch'
if (Test-Path $scratch) { Remove-Item -LiteralPath $scratch -Recurse -Force }
New-Item -ItemType Directory -Force -Path (Join-Path $scratch 'docs/migrations'), (Join-Path $scratch 'deploy'), (Join-Path $scratch 'backend/scripts') | Out-Null
Copy-Item -Path (Join-Path $RepoRoot 'docs/migrations/*.sql') -Destination (Join-Path $scratch 'docs/migrations') -Force
Copy-Item -LiteralPath $guard -Destination (Join-Path $scratch $guardRel) -Force
$scratchManifest = Join-Path $scratch $manifestRel
$scratchRegistry = Join-Path $scratch $registryRel
$origManifestText = [System.IO.File]::ReadAllText($manifest)
$origRegistryText = [System.IO.File]::ReadAllText($registry)
$utf8 = New-Object System.Text.UTF8Encoding($false)
$eol = "`r`n"

function Reset-Scratch {
  [System.IO.File]::WriteAllText($scratchManifest, $origManifestText, $utf8)
  [System.IO.File]::WriteAllText($scratchRegistry, $origRegistryText, $utf8)
}
Reset-Scratch
$scratchGreen = Invoke-Guard -ExtraArgs @('--root', $scratch) -Label "$($Prefix)c-guard-scratch-baseline-green"
Write-Output "---- [$($Prefix)c-guard-scratch-baseline-green] exit=$($scratchGreen.rc)（scratch 基线：应绿）----"
Assert-Equal $scratchGreen.rc 0 'scratch 基线（真件副本）⇒ EXIT'

# ---------- 反测 ②：清单活动段指向不存在的文件 ----------
Reset-Scratch
[System.IO.File]::WriteAllText($scratchManifest, ($origManifestText.TrimEnd() + $eol + "999_不存在的迁移.sql" + $eol), $utf8)
$red2 = Invoke-Guard -ExtraArgs @('--root', $scratch) -Label "$($Prefix)d-guard-red-manifest-points-to-missing-file"
Show-Guard $red2 "$($Prefix)d-guard-red-manifest-points-to-missing-file"
Assert-Equal $red2.rc 1 '反测②：清单里有不存在的文件 ⇒ EXIT'
Assert-Contains $red2.text '999_不存在的迁移.sql' '反测②：点名到该文件'

# ---------- 反测 ③：清单活动段少登记一个**真实**迁移 ----------
#   注意：必须在"未掺入 999 行的原清单"上删，否则删掉的是反测② 加进去的那行，
#   "删一行 ⇒ 应当红"会被"刚好恢复到原状"骗过（s3241 首版就是这样翻车的）。
Reset-Scratch
$droppedFromManifest = '204_系统设置域权限点立码.sql'
$kept = ([System.IO.File]::ReadAllLines($manifest)) | Where-Object { $_.Trim() -ne $droppedFromManifest }
[System.IO.File]::WriteAllText($scratchManifest, (($kept -join $eol) + $eol), $utf8)
Write-Output "== 反测③：从清单活动段删掉真实迁移行「$droppedFromManifest」"
$red3 = Invoke-Guard -ExtraArgs @('--root', $scratch) -Label "$($Prefix)e-guard-red-manifest-missing-real-file"
Show-Guard $red3 "$($Prefix)e-guard-red-manifest-missing-real-file"
Assert-Equal $red3.rc 1 '反测③：活动段少登记真实文件（三条通道都没有 ⇒ 未登记）'
Assert-Contains $red3.text $droppedFromManifest '反测③：点名到被删行的文件'

# ---------- 反测 ④：登记册少一条**真实**文件 ----------
Reset-Scratch
$droppedFromRegistry = (($regLines[0] -split '\|')[0]).Trim()
$regKept = (Get-Content -LiteralPath $registry) | Where-Object { -not $_.Trim().StartsWith($droppedFromRegistry + ' |') }
[System.IO.File]::WriteAllText($scratchRegistry, (($regKept -join $eol) + $eol), $utf8)
Write-Output "== 反测④：从登记册删掉真实登记行「$droppedFromRegistry」"
$red4 = Invoke-Guard -ExtraArgs @('--root', $scratch) -Label "$($Prefix)f-guard-red-registry-missing-real-file"
Show-Guard $red4 "$($Prefix)f-guard-red-registry-missing-real-file"
Assert-Equal $red4.rc 1 '反测④：登记册少一条真实文件 ⇒ EXIT'
Assert-Contains $red4.text $droppedFromRegistry '反测④：点名到该文件'
Assert-Contains $red4.text '未登记' '反测④：报"未登记"（三条通道都没有）'

# ---------- 反测 ⑤：登记册行格式不合法（缺 owner 列） ----------
Reset-Scratch
$badRegFile = (($regLines[0] -split '\|')[0]).Trim()
$regBad = (Get-Content -LiteralPath $registry) -replace [regex]::Escape($regLines[0]), ("$badRegFile | 只有两列")
[System.IO.File]::WriteAllText($scratchRegistry, (($regBad -join $eol) + $eol), $utf8)
Write-Output "== 反测⑤：把登记册首行改成两列（缺 owner 单号）"
$red5 = Invoke-Guard -ExtraArgs @('--root', $scratch) -Label "$($Prefix)g-guard-red-registry-bad-line"
Show-Guard $red5 "$($Prefix)g-guard-red-registry-bad-line"
Assert-Equal $red5.rc 1 '反测⑤：登记册行格式不合法 ⇒ EXIT'
Assert-Contains $red5.text '登记册行格式不合法' '反测⑤：报"登记册行格式不合法"'
Assert-Contains $red5.text $badRegFile '反测⑤：点名到该行'

# ---------- 反测 ⑥：同一文件既在活动段又在登记册（自相矛盾） ----------
Reset-Scratch
$dupFile = (($regLines[1] -split '\|')[0]).Trim()
[System.IO.File]::WriteAllText($scratchManifest, ($origManifestText.TrimEnd() + $eol + $dupFile + $eol), $utf8)
Write-Output "== 反测⑥：把已在登记册的「$dupFile」再写进清单活动段"
$red6 = Invoke-Guard -ExtraArgs @('--root', $scratch) -Label "$($Prefix)h-guard-red-registry-cross-duplicate"
Show-Guard $red6 "$($Prefix)h-guard-red-registry-cross-duplicate"
Assert-Equal $red6.rc 1 '反测⑥：同一文件跨通道重复登记 ⇒ EXIT'
Assert-Contains $red6.text '重复登记' '反测⑥：报"重复登记"'
Assert-Contains $red6.text $dupFile '反测⑥：点名到该文件'

# ---------- 反测 ⑦：登记册指向不存在的文件 ----------
Reset-Scratch
[System.IO.File]::WriteAllText($scratchRegistry, ($origRegistryText.TrimEnd() + $eol + "999_不存在的登记项.sql | 形态 | 理由 | 夹具" + $eol), $utf8)
$red7 = Invoke-Guard -ExtraArgs @('--root', $scratch) -Label "$($Prefix)i-guard-red-registry-points-to-missing-file"
Show-Guard $red7 "$($Prefix)i-guard-red-registry-points-to-missing-file"
Assert-Equal $red7.rc 1 '反测⑦：登记册指向不存在的文件 ⇒ EXIT'
Assert-Contains $red7.text '999_不存在的登记项.sql' '反测⑦：点名到该文件'

# ---------- 复原并复跑（scratch 恢复真件副本 ⇒ 仍须 EXIT=0 + SHA256 一致）----------
Reset-Scratch
$restored = Invoke-Guard -ExtraArgs @('--root', $scratch) -Label "$($Prefix)j-guard-restored-scratch"
Show-Guard $restored "$($Prefix)j-guard-restored-scratch"
Assert-Equal $restored.rc 0 '复原后（scratch）：EXIT'
$restoredManifestHash = (Get-FileHash -LiteralPath $scratchManifest -Algorithm SHA256).Hash
$origManifestHash = (Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash
$restoredRegistryHash = (Get-FileHash -LiteralPath $scratchRegistry -Algorithm SHA256).Hash
$origRegistryHash = (Get-FileHash -LiteralPath $registry -Algorithm SHA256).Hash
Assert-Equal $restoredManifestHash $origManifestHash '复原后：scratch 清单 SHA256 == 工作树清单 SHA256'
Assert-Equal $restoredRegistryHash $origRegistryHash '复原后：scratch 登记册 SHA256 == 工作树登记册 SHA256'

# ---------- 工作树真件终态复核 ----------
$finalManifestHash = (Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash
$finalRegistryHash = (Get-FileHash -LiteralPath $registry -Algorithm SHA256).Hash
Write-Output ("== 工作树清单终态 SHA256 = " + $finalManifestHash.Substring(0, 16))
Write-Output ("== 工作树登记册终态 SHA256 = " + $finalRegistryHash.Substring(0, 16))
Assert-Equal $finalManifestHash $origManifestHash '终态：工作树清单 SHA256 未被反测污染'
Assert-Equal $finalRegistryHash $origRegistryHash '终态：工作树登记册 SHA256 未被反测污染'
$final = Invoke-Guard -Label "$($Prefix)k-guard-final-green"
Show-Guard $final "$($Prefix)k-guard-final-green"
Assert-Equal $final.rc 0 '终态：工作树三通道 EXIT'

Write-Output ""
if ($script:failures.Count -gt 0) {
  Write-Output ("== 反测装置结论：FAIL（$(($script:failures | Measure-Object).Count) 处断言未过）")
  $script:failures | ForEach-Object { Write-Output "   - $_" }
  exit 1
}
Write-Output "== 反测装置结论：PASS（绿侧 2 例 + 反测 7 例，红绿两侧均达预期；工作树真件 SHA256 未被污染）"
exit 0
