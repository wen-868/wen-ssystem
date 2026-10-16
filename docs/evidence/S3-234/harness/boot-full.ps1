# S3-234 证据装置：整段启动期迁移（runMigrations，含 docs/migrations 全量语料）跑一遍，日志落盘。
# 用途：① 空库第一遍 ⇒ 建出夹具库（312 张表）；② 非空库第二遍 ⇒ 观察"已应用重复跑"的启动期结论。
#
# 用法（仓库根执行）：
#   pwsh -File docs/evidence/S3-234/harness/boot-full.ps1 -OutFile <日志路径> [-WriteGate block|allow] [-Port 8191] [-DbPort 3409] [-KeepRunning]
param(
  [Parameter(Mandatory = $true)][string]$OutFile,
  [ValidateSet('block', 'allow')][string]$WriteGate = 'block',
  [int]$Port = 8191,
  [int]$DbPort = 3409,
  [switch]$KeepRunning,
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
)

$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = "$DbPort"
$env:DB_USER = 'root'
$env:DB_PASSWORD = ''
$env:DB_NAME = 'liquor_inventory'
$env:NODE_ENV = 'production'
$env:JWT_SECRET = 's3234-fixture-secret'
$env:CSRF_SECRET = 's3234-fixture-csrf'
$env:CORS_ORIGINS = "http://127.0.0.1:$Port"
$env:PORT = "$Port"
$env:USE_MOCK_DB = 'false'
$env:MIGRATION_WRITE_GATE = $WriteGate

$outAbs = [System.IO.Path]::GetFullPath($OutFile)
$errAbs = "$outAbs.err"
New-Item -ItemType Directory -Force -Path (Split-Path $outAbs) | Out-Null

$proc = Start-Process -FilePath 'node' -ArgumentList (Join-Path $RepoRoot 'backend\dist\server.js') `
  -WorkingDirectory $RepoRoot -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $outAbs -RedirectStandardError $errAbs
Write-Output "== 启动 pid=$($proc.Id)｜cwd=$RepoRoot｜写闸门=$WriteGate｜日志=$outAbs"

$deadline = (Get-Date).AddSeconds(240)
$done = $false
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 3
  if (Test-Path $outAbs) {
    $text = Get-Content -LiteralPath $outAbs -Raw -ErrorAction SilentlyContinue
    if ($text -match '所有迁移完成') { $done = $true; break }
  }
  if ($proc.HasExited) { break }
}
Start-Sleep -Seconds 2
if (-not $KeepRunning -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
Write-Output "== 「所有迁移完成」=$done｜进程退出=$($proc.HasExited)｜保留运行=$KeepRunning"

$text = if (Test-Path $outAbs) { Get-Content -LiteralPath $outAbs -Raw } else { '' }
$failLines = ($text -split "`n") | Where-Object { $_ -match '\[migration\].*失败' }
Write-Output "== [migration] 失败行数：$(($failLines | Measure-Object).Count)"
$failLines | ForEach-Object { Write-Output "   $($_.Trim())" }
$skipLines = ($text -split "`n") | Where-Object { $_ -match '写闸门=[a-z]+|跳过 \(ER_' }
Write-Output "== 写闸门/跳过行数：$(($skipLines | Measure-Object).Count)（明细见日志）"
