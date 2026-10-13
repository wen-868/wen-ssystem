<#
  S3-186 装置⑦：在某个**已跑完迁移的库**上，把 173 条 CALL 真正执行一遍（先按 092 原文建两个存储过程），
  得到"补列语句全部落地"的基线结构，并与指定快照比对。

  用法：
    powershell -File docs/evidence/S3-186/harness/replay-baseline.ps1 -DbName s3186_a2 -Tag runB -CompareTag runA
#>
param(
  [Parameter(Mandatory = $true)][string]$DbName,
  [Parameter(Mandatory = $true)][string]$Tag,
  [string]$CompareTag = ""
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
$outDir = Join-Path $repo "docs\evidence\S3-186\outputs"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$log = Join-Path $outDir "$Tag-replay.log"
$snap = Join-Path $outDir "$Tag-snapshot.json"
$calls = Join-Path $outDir "calls.json"

$env:S3186_REPO_ROOT = $repo
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "3406"
$env:DB_USER = "root"
$env:DB_PASSWORD = ""
$env:DB_NAME = $DbName
$env:JWT_SECRET = "s3186-local-secret"
$env:NODE_ENV = "development"
Set-Location $repo

"### S3-186 基线用例 $Tag  db=$DbName  $(Get-Date -Format o)" | Set-Content -Path $log -Encoding utf8
cmd /c "node docs\evidence\S3-186\harness\collect-calls.mjs `"$calls`" >> `"$log`" 2>&1"
cmd /c "node docs\evidence\S3-186\harness\replay-calls.mjs $DbName `"$calls`" `"$outDir\$Tag-replay.json`" >> `"$log`" 2>&1"
cmd /c "node docs\evidence\S3-186\harness\snapshot.mjs $DbName `"$snap`" >> `"$log`" 2>&1"

if ($CompareTag -ne "") {
  $base = Join-Path $outDir "$CompareTag-snapshot.json"
  cmd /c "node docs\evidence\S3-186\harness\diff.mjs `"$base`" `"$snap`" `"$outDir\diff-$CompareTag-vs-$Tag.txt`" >> `"$log`" 2>&1"
  "DIFF_EXIT=$LASTEXITCODE" | Add-Content -Path $log -Encoding utf8
}

Get-Content -LiteralPath $log -Encoding utf8 | Select-Object -Last 25
