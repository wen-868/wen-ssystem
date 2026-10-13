<#
  S3-190 装置⑥：一次性跑完"一个用例"——建空库 → 跑产品迁移 → 落日志 → 结构快照。

  用法（任意 cwd）：
    powershell -File docs/evidence/S3-190/harness/run-case.ps1 -DbName s3186_a -Tag runA
    可选 -WriteGate allow      # 显式放开 MIG-4 写闸门（诊断用，默认不设 = 产品默认 block）

  产出（docs/evidence/S3-190/outputs/ 下）：
    <Tag>-migration.log       迁移原始 stdout+stderr
    <Tag>-snapshot.json       结构快照
    <Tag>-counts.txt          关键读数（跳过统计）
#>
param(
  [Parameter(Mandatory = $true)][string]$DbName,
  [Parameter(Mandatory = $true)][string]$Tag,
  [string]$WriteGate = "",
  [switch]$NoReset   # 复跑幂等性用：不重建空库，直接在现有库上再跑一遍迁移
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
$outDir = Join-Path $repo "docs\evidence\S3-190\outputs"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$log = Join-Path $outDir "$Tag-migration.log"
$snap = Join-Path $outDir "$Tag-snapshot.json"

$mdbBin = "D:\Users\ZXQL\tools\mariadb\mariadb-11.4.5-winx64\bin"
if (-not $NoReset) {
  & "$mdbBin\mariadb.exe" --host=127.0.0.1 --port=3406 --user=root --skip-ssl `
    -e "DROP DATABASE IF EXISTS $DbName; CREATE DATABASE $DbName DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"
}

$env:S3186_REPO_ROOT = $repo
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "3406"
$env:DB_USER = "root"
$env:DB_PASSWORD = ""
$env:DB_NAME = $DbName
$env:JWT_SECRET = "s3190-local-secret"
$env:NODE_ENV = "development"
$env:USE_MOCK_DB = "false"
if ($WriteGate -ne "") { $env:MIGRATION_WRITE_GATE = $WriteGate } else { Remove-Item Env:\MIGRATION_WRITE_GATE -ErrorAction SilentlyContinue }

Set-Location $repo
"### S3-190 用例 $Tag  db=$DbName  writeGate=$(if ($WriteGate -eq '') { '<未设置=block>' } else { $WriteGate })  $(Get-Date -Format o)" |
  Set-Content -Path $log -Encoding utf8
# 用 cmd 重定向落盘：node 输出 UTF-8 字节原样入文件，避免 PowerShell 5.1 转成 UTF-16 造成乱码
cmd /c "node docs\evidence\S3-190\harness\run-migrations.mjs >> `"$log`" 2>&1"
"RUNNER_EXIT=$LASTEXITCODE" | Add-Content -Path $log -Encoding utf8

cmd /c "node docs\evidence\S3-190\harness\snapshot.mjs $DbName `"$snap`" >> `"$log`" 2>&1"

$content = Get-Content -LiteralPath $log -Encoding utf8
$gateSkipped = ($content | Select-String -Pattern "写闸门 block 跳过 CALL" -SimpleMatch).Count
$spMissing = ($content | Select-String -Pattern "ER_SP_DOES_NOT_EXIST").Count
$execErr = ($content | Select-String -Pattern "\[migration\].*失败" ).Count
$counts = @(
  "TAG=$Tag",
  "DB=$DbName",
  "WRITE_GATE=$(if ($WriteGate -eq '') { 'block(default)' } else { $WriteGate })",
  "写闸门跳过 CALL 条数=$gateSkipped",
  "ER_SP_DOES_NOT_EXIST 次数=$spMissing",
  "safeExec 记失败行数=$execErr",
  "LOG=$log",
  "SNAPSHOT=$snap"
) -join "`n"
$counts | Tee-Object -FilePath (Join-Path $outDir "$Tag-counts.txt")
