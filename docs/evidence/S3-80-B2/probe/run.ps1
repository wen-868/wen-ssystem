<#
  S3-80 B-2 探针复跑脚本（Windows / PowerShell）

  用法：
    pwsh -File docs/evidence/S3-80-B2/probe/run.ps1            # 跑 01（沙箱可跑：SQLite 替身 + 真实服务代码）
    pwsh -File docs/evidence/S3-80-B2/probe/run.ps1 -Mysql     # 跑 02（需真库；无库时给出明确提示）

  说明：01 只替换数据访问层（shared/db → SQLite 替身），产品代码一行不改；
        02 不打任何替身，走真实 mysql2 + 真库。
#>
param([switch]$Mysql)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path "$PSScriptRoot/../../../..").Path
Set-Location $repo

# 探针所需最小环境变量（真库探针会用 backend/.env 里的 DB_* 覆盖）
$env:JWT_SECRET = if ($env:JWT_SECRET) { $env:JWT_SECRET } else { "b2-probe-secret" }
$env:NODE_ENV  = "production"
$env:LOG_LEVEL = "silent"

if ($Mysql) {
  Set-Location "$repo/backend"
  node --import ../docs/evidence/S3-80-B2/probe/register-real-mysql.mjs ../docs/evidence/S3-80-B2/probe/02-mysql-probe.mts 2>&1 |
    Tee-Object -FilePath "$repo/docs/evidence/S3-80-B2/output-mysql-probe.txt"
} else {
  node --import ./docs/evidence/S3-80-B2/probe/register.mjs docs/evidence/S3-80-B2/probe/01-idempotency-probe.mts 2>&1 |
    Tee-Object -FilePath "$repo/docs/evidence/S3-80-B2/output-sqlite-probe.txt"
}

Write-Output "exit=$LASTEXITCODE"
