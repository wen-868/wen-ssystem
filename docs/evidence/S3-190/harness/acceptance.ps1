<#
  S3-190 装置①①（验收判据总入口）：全新空库 → 跑产品迁移（默认写闸门）→ 结构快照 → 与基线比对。

  判据（机器可判，EXIT 0 = 绿）：
    ① 全新空库一次跑完，与基线结构差异 = 0（表 / 列 / 索引 / 列定义）；
    ② 日志中"写闸门 block 跳过 CALL" = 0 条（补列语句不再被静默挡下）；
    ③ 日志中 ER_SP_DOES_NOT_EXIST = 0 条（不依赖存储过程）；
    ④ 存储过程残留 = 0（S3-57-D1 的判据不回归）。

  用法：
    powershell -File docs/evidence/S3-190/harness/acceptance.ps1 -DbName s3186_c -Tag runC `
      -Baseline docs/evidence/S3-190/outputs/runB-snapshot.json
#>
param(
  [Parameter(Mandatory = $true)][string]$DbName,
  [Parameter(Mandatory = $true)][string]$Tag,
  [string]$Baseline = "docs\evidence\S3-190\outputs\runB-snapshot.json",
  [string]$WriteGate = ""
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
Set-Location $repo
$env:S3186_REPO_ROOT = $repo
$env:JWT_SECRET = "s3190-local-secret"

if ($WriteGate -eq "") {
  powershell -NoProfile -File docs\evidence\S3-190\harness\run-case.ps1 -DbName $DbName -Tag $Tag | Out-Null
} else {
  powershell -NoProfile -File docs\evidence\S3-190\harness\run-case.ps1 -DbName $DbName -Tag $Tag -WriteGate $WriteGate | Out-Null
}

$snap = Join-Path $repo "docs\evidence\S3-190\outputs\$Tag-snapshot.json"
$detail = Join-Path $repo "docs\evidence\S3-190\outputs\acceptance-$Tag.txt"
node docs\evidence\S3-190\harness\diff.mjs (Join-Path $repo $Baseline) $snap $detail > $null 2>&1
$diffExit = $LASTEXITCODE
$counts = Get-Content -LiteralPath (Join-Path $repo "docs\evidence\S3-190\outputs\$Tag-counts.txt") -Encoding utf8
$gateCall = [int]((($counts | Select-String '写闸门跳过 CALL 条数=').Line -split '=')[1])
$spMiss = [int]((($counts | Select-String 'ER_SP_DOES_NOT_EXIST 次数=').Line -split '=')[1])
$snapJson = Get-Content -LiteralPath $snap -Raw -Encoding utf8 | ConvertFrom-Json
$routines = $snapJson.counts.routines

$diffHead = (Get-Content -LiteralPath $detail -Encoding utf8 | Select-String '^差异合计' | Select-Object -First 1).Line
Write-Output "判据① 结构差异 = 0            : $(if ($diffExit -eq 0) { 'PASS' } else { "FAIL（$diffHead）" })"
Write-Output "判据② 写闸门跳过 CALL = 0     : $(if ($gateCall -eq 0) { 'PASS' } else { "FAIL（$gateCall 条被静默跳过）" })"
Write-Output "判据③ ER_SP_DOES_NOT_EXIST = 0: $(if ($spMiss -eq 0) { 'PASS' } else { "FAIL（$spMiss 次）" })"
Write-Output "判据④ 存储过程残留 = 0        : $(if ($routines -eq 0) { 'PASS' } else { "FAIL（残留 $routines）" })"
Write-Output "明细：$detail"

if ($diffExit -eq 0 -and $gateCall -eq 0 -and $spMiss -eq 0 -and $routines -eq 0) {
  Write-Output "S3186_ACCEPTANCE=GREEN"
  exit 0
}
Write-Output "S3186_ACCEPTANCE=RED"
exit 1
