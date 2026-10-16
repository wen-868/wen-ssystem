# S3-235 证据装置：在"空库"上跑后端启动链（= 生产/灾备同款的 docs/migrations 全链执行通道）
#
# 为什么用后端启动链：本项目的外部迁移由 `backend/src/shared/migration.ts` 在启动时按文件名顺序执行
# `docs/migrations/*.sql`（含写闸门 MIGRATION_WRITE_GATE）。灾备/新库重建走的正是这条链。
#
# 用法（仓库根 = 工作树根，需先 `npm ci` + `cd backend; npm run build`）：
#   powershell -File docs/evidence/S3-235/tools/boot-chain.ps1 -DbName liq235_green -GateMode allow -LogFile <raw 日志路径> -HttpPort 3599
#
# 参数：
#   -DbName   目标库（**必须是已建好的空库**；本脚本不建库、不删库）
#   -GateMode block（默认，写闸门挡 INSERT/UPDATE/DELETE/REPLACE/CALL） | allow（放行）
#   -LogFile  原始日志落盘路径
#   -HttpPort HTTP 服务端口（只为不与其它实例撞车；与本单判据无关）
param(
  [Parameter(Mandatory = $true)][string]$DbName,
  [Parameter(Mandatory = $true)][string]$LogFile,
  [string]$GateMode = "block",
  [int]$HttpPort = 3599,
  [int]$TimeoutSec = 240
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path   # → 工作树根

$env:JWT_SECRET = "s3-235-local-fixture-only-not-a-secret"
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "3421"
$env:DB_USER = "root"
$env:DB_PASSWORD = ""
$env:DB_NAME = $DbName
$env:PORT = "$HttpPort"
$env:NODE_ENV = "production"
$env:CORS_ORIGINS = "http://localhost:5173"
if ($GateMode -eq "allow") { $env:MIGRATION_WRITE_GATE = "allow" } else { Remove-Item Env:MIGRATION_WRITE_GATE -ErrorAction SilentlyContinue }

Write-Output "[boot-chain] cwd=$root db=$DbName gate=$GateMode port=$HttpPort log=$LogFile"
$proc = Start-Process -FilePath "node" -ArgumentList "backend/dist/server.js" -WorkingDirectory $root `
  -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $LogFile -RedirectStandardError ($LogFile + ".err")

$deadline = (Get-Date).AddSeconds($TimeoutSec)
$done = $false
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 3
  if (Test-Path $LogFile) {
    if (Select-String -LiteralPath $LogFile -Pattern "所有迁移完成" -Quiet -ErrorAction SilentlyContinue) { $done = $true; break }
  }
  if ($proc.HasExited) { break }
}

Start-Sleep -Seconds 2
if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
Write-Output "[boot-chain] 迁移完成标记=$done；进程已退出=$($proc.HasExited)；日志=$LogFile"
