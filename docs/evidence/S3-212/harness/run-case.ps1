<#
S3-212 空库迁移取证装置（MySQL 8，指定端口实例）
用法：
  powershell -NoProfile -File run-case.ps1 -Repo <工作树> -DbName <库名> -Port <服务端口> -Tag <证据标签> -DbPort <库端口> -MyBin <mysql 客户端 bin 目录> [-NoDrop]
行为：
  1) 记录输入指纹（HEAD / 语料 sha256 / dist sha256）
  2) （默认）DROP+CREATE 新库；-NoDrop 时复用既有库（用于幂等第二遍）
  3) 起 node backend/dist/server.js（production 语义），等 /health
  4) 停服务，统计迁移日志里 "失败" 命中数并原样输出
#>
param(
  [Parameter(Mandatory=$true)][string]$Repo,
  [Parameter(Mandatory=$true)][string]$DbName,
  [int]$Port = 8097,
  [Parameter(Mandatory=$true)][string]$Tag,
  [int]$DbPort = 3407,
  [string]$MyBin = 'C:\Users\XIONG\AppData\Local\Temp\mysql80\mysql-8.0.28-winx64\bin',
  [string]$Base = 'D:\Users\ZXQL\wt-agents\_s3212-evidence',
  [switch]$NoDrop,
  [int]$WaitSec = 200
)
$ErrorActionPreference = 'Continue'
$out = Join-Path $Base $Tag
New-Item -ItemType Directory -Force -Path $out | Out-Null
$log = Join-Path $out 'mig.log'
if (Test-Path $log) { Remove-Item -LiteralPath $log -Force }

# ---------- 1. 输入指纹 ----------
$fp = Join-Path $out 'fingerprint.txt'
$lines = @()
$lines += "tag        = $Tag"
$lines += "repo       = $Repo"
$lines += "db         = $DbName @ 127.0.0.1:$DbPort"
$lines += "appPort    = $Port"
$lines += "time       = $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$lines += "node       = $(node --version)"
$lines += "HEAD       = $(git -C $Repo rev-parse HEAD)"
$lines += "branch     = $(git -C $Repo rev-parse --abbrev-ref HEAD)"
$lines += "dirty      = $(@(git -C $Repo status --porcelain).Count) 项"
foreach ($f in @('173_open_platform_api_key_columns.sql','017_phase10_instant_retail.sql','016_phase9_tenant_subscription.sql','008_phase6_schema.sql','001_phase1_schema.sql','006_phase4_schema.sql','007_phase5_schema.sql','020_migrate_v3_payment_miniapp.sql','029_add_tenant.sql','070_品牌表.sql','071_客户积分.sql','074_即时零售表.sql','092_租户ID.sql','108_miniapp_member_wholesale.sql','120d_fix_server_3bugs.sql','163_transfer_order_columns_fill.sql','192_租户建租户与归因落点补列.sql')) {
  $p = Join-Path $Repo "docs\migrations\$f"
  if (Test-Path $p) {
    $lines += ("src  sha256 {0}  {1}" -f (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.Substring(0,16), $f)
  }
}
foreach ($f in @('backend\src\shared\migration.ts','docs\init_database.sql')) {
  $p = Join-Path $Repo $f
  if (Test-Path $p) {
    $lines += ("src  sha256 {0}  {1}" -f (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.Substring(0,16), $f)
  }
}
foreach ($f in @('backend\dist\shared\migration.js','backend\dist\shared\seed-data.js','backend\dist\server.js')) {
  $p = Join-Path $Repo $f
  if (Test-Path $p) {
    $lines += ("dist sha256 {0}  {1}" -f (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.Substring(0,16), $f)
  }
}
$lines | Set-Content -LiteralPath $fp -Encoding UTF8
$lines | ForEach-Object { Write-Output $_ }

# ---------- 2. 新库 ----------
$srvArgs = @('--no-defaults','-h','127.0.0.1','-P',"$DbPort",'-u','root')
if ($NoDrop) {
  $cs0 = & "$MyBin\mysql.exe" @srvArgs -N -B -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DbName';"
  Write-Output "（-NoDrop）复用既有库 $DbName，现有表数 = $cs0"
} else {
  & "$MyBin\mysql.exe" @srvArgs -e "DROP DATABASE IF EXISTS $DbName; CREATE DATABASE $DbName;" 2>&1 | Write-Output
}
$cs = & "$MyBin\mysql.exe" @srvArgs -N -B -e "SELECT CONCAT(@@version,' / ',@@character_set_server,' / ',@@collation_server);"
Write-Output "server = $cs"

# ---------- 3. 起服务跑迁移 ----------
$env:DB_HOST='127.0.0.1'; $env:DB_PORT="$DbPort"; $env:DB_USER='root'; $env:DB_PASSWORD=''
$env:DB_NAME=$DbName; $env:NODE_ENV='production'; $env:JWT_SECRET='ci-migration-secret'
$env:CORS_ORIGINS="http://127.0.0.1:$Port"; $env:PORT="$Port"
$p = Start-Process -FilePath 'node' -WorkingDirectory $Repo -WindowStyle Hidden `
     -ArgumentList @('backend/dist/server.js') `
     -RedirectStandardOutput $log -RedirectStandardError (Join-Path $out 'mig.err.log') -PassThru
$healthy = $false
for ($i = 0; $i -lt $WaitSec; $i++) {
  Start-Sleep -Seconds 1
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/health" -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) { $healthy = $true; break }
  } catch { }
}
Write-Output "health200 = $healthy （等待 ${i}s）"
Start-Sleep -Seconds 2
if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force }
Start-Sleep -Seconds 1

# ---------- 4. 统计 ----------
$hits = @(Select-String -LiteralPath $log -Pattern '失败' -SimpleMatch)
Write-Output "失败命中数 = $($hits.Count)"
$hits | ForEach-Object { "L$($_.LineNumber): $($_.Line)" }
$skips = @(Select-String -LiteralPath $log -Pattern '跳过' -SimpleMatch)
Write-Output "跳过命中数 = $($skips.Count)"
$skips | ForEach-Object { "L$($_.LineNumber): $($_.Line)" }
