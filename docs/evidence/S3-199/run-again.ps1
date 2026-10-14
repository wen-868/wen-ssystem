<#
S3-199 幂等复跑装置：**不重建库**，对同一库再跑一次启动期迁移（验证「第二遍零变更」）。
用法：powershell -NoProfile -File run-again.ps1 -Repo <工作树> -DbName <库名> -Port <服务端口> -Tag <证据标签>
      -MyBin <mysql bin 目录> -DbPort <库端口> [-Base <证据根>]
行为：起 node backend/dist/server.js（production 语义）→ 等 /health → 停服务 → 统计迁移日志 "失败" 命中数。
对比方式：本装置前后各取一次结构快照（S3-194 的 snapshot.ps1），比对快照 sha256 是否零差异。
#>
param(
  [Parameter(Mandatory=$true)][string]$Repo,
  [Parameter(Mandatory=$true)][string]$DbName,
  [int]$Port = 8099,
  [Parameter(Mandatory=$true)][string]$Tag,
  [Parameter(Mandatory=$true)][string]$MyBin,
  [int]$DbPort = 3408,
  [string]$Base = 'D:\Users\ZXQL\wt-agents\_s3199-evidence',
  [int]$WaitSec = 150
)
$ErrorActionPreference = 'Continue'
$out = Join-Path $Base $Tag
New-Item -ItemType Directory -Force -Path $out | Out-Null
$log = Join-Path $out 'mig.log'
if (Test-Path $log) { Remove-Item -LiteralPath $log -Force }

$lines = @()
$lines += "tag        = $Tag"
$lines += "repo       = $Repo"
$lines += "db         = $DbName @ 127.0.0.1:$DbPort （本装置**不**重建库）"
$lines += "time       = $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$lines += "HEAD       = $(git -C $Repo rev-parse HEAD)"
$lines += "dirty      = $(@(git -C $Repo status --porcelain).Count) 项"
$lines += "dist sha256 {0}  backend/dist/server.js" -f (Get-FileHash -LiteralPath (Join-Path $Repo 'backend\dist\server.js') -Algorithm SHA256).Hash.Substring(0,16)
$lines += "dist sha256 {0}  backend/dist/shared/migration.js" -f (Get-FileHash -LiteralPath (Join-Path $Repo 'backend\dist\shared\migration.js') -Algorithm SHA256).Hash.Substring(0,16)
$lines | Set-Content -LiteralPath (Join-Path $out 'fingerprint.txt') -Encoding UTF8
$lines | ForEach-Object { Write-Output $_ }

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

$hits = @(Select-String -LiteralPath $log -Pattern '失败' -SimpleMatch)
Write-Output "失败命中数 = $($hits.Count)"
$hits | ForEach-Object { "L$($_.LineNumber): $($_.Line)" }
