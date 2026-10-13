<#
S3-194 空库迁移取证装置（MySQL 8 / 任意本地库）
用法：
  powershell -NoProfile -File run-case.ps1 -Repo <工作树> -Db <库名> -Port <服务端口> -Tag <证据标签>
行为：
  1) 记录输入指纹（HEAD / 关键语料 sha256 / 关键 dist 文件 sha256）
  2) DROP+CREATE 新库（继承服务器默认字符集，等价 CI 的 MYSQL_DATABASE=major）
  3) 起 node backend/dist/server.js（production 语义），等 /health
  4) 停服务，统计迁移日志里 "失败" 命中数并原样输出
#>
param(
  [Parameter(Mandatory=$true)][string]$Repo,
  [Parameter(Mandatory=$true)][string]$DbName,
  [int]$Port = 8097,
  [Parameter(Mandatory=$true)][string]$Tag,
  [string]$Base = 'D:\Users\ZXQL\wt-agents\_s3194-evidence',
  [string]$MyBin = 'C:\Users\XIONG\AppData\Local\Temp\mysql80\mysql-8.0.28-winx64\bin',
  [string]$ClientArgs = '--no-defaults',
  [string]$ClientPwd = '',
  [int]$DbPort = 3407,
  [int]$WaitSec = 150
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
$lines += "time       = $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$lines += "node       = $(node --version)"
$lines += "HEAD       = $(git -C $Repo rev-parse HEAD)"
$lines += "branch     = $(git -C $Repo rev-parse --abbrev-ref HEAD)"
$lines += "dirty      = $(@(git -C $Repo status --porcelain).Count) 项"
foreach ($f in @('013_phase6_schema.sql','016_phase9_tenant_subscription.sql','017_phase10_instant_retail.sql','031_add_subscription.sql','032_add_tenant_module_access.sql','034_add_tenant_admin.sql','046_配送记录表.sql','074_门店订单明细外键对齐.sql','192_租户建租户与归因落点补列.sql')) {
  $p = Join-Path $Repo "docs\migrations\$f"
  if (Test-Path $p) {
    $lines += ("src  sha256 {0}  {1}" -f (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.Substring(0,16), $f)
  }
}
foreach ($f in @('backend\src\shared\migration.ts','backend\src\shared\seed-data.ts')) {
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
$clientArgArr = @($ClientArgs -split ',' | Where-Object { $_ -ne '' })
$srvArgs = $clientArgArr + @('-h','127.0.0.1','-P',"$DbPort",'-u','root')
if ($ClientPwd -ne '') { $srvArgs += "-p$ClientPwd" }
& "$MyBin\mysql.exe" @srvArgs -e "DROP DATABASE IF EXISTS $DbName; CREATE DATABASE $DbName;" 2>&1 | Write-Output
$cs = & "$MyBin\mysql.exe" @srvArgs -N -B -e "SELECT CONCAT(@@version,' / ',@@character_set_server,' / ',@@collation_server);"
Write-Output "server = $cs"

# ---------- 3. 起服务跑迁移 ----------
$env:DB_HOST='127.0.0.1'; $env:DB_PORT="$DbPort"; $env:DB_USER='root'; $env:DB_PASSWORD=$ClientPwd
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
