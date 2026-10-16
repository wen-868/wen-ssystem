# S3-234 证据装置：用**真实启动期迁移通道**（backend/dist/server.js → runMigrations）跑 069，观察它在非空库上的表现。
#
# 为什么这样取证：069 的"非空库重跑报 Duplicate foreign key constraint name"**只在启动期通道**可见 ——
#   启动期是**逐语句 safeExec**（1060 已存在列 → 跳过并继续），于是会走到第 3 条 ADD CONSTRAINT 并报
#   errno 1826（ER_FK_DUP_NAME，不在跳过集合里）⇒ 日志里一行 `[migration] 069_... 失败: ...`；
#   而部署通道（run-migration.mjs 整文件下发）在第 1 条就因 "Duplicate column" 被判为"已应用，跳过" ⇒ exit 0。
#   两条通道必须都过，所以两侧都要测。
#
# 做法：把 cwd 指到一个只放 069 的 scratch 目录（迁移段按 `${cwd}/docs/migrations` 找语料），
#   -Mode original ⇒ 放 `git show HEAD:<069 路径>` 的**原版**（无守卫）；
#   -Mode fixed    ⇒ 放工作树里的**修复版**（带守卫）。
#   其余迁移语料一个都不放 ⇒ 日志里只有 069 的结论，不受别的文件噪声污染。
#
# 用法（仓库根执行）：
#   pwsh -File docs/evidence/S3-234/harness/boot-runtime-migration-069.ps1 -Mode original -Port 8097 -DbPort 3409
param(
  [Parameter(Mandatory = $true)][ValidateSet('original', 'fixed')][string]$Mode,
  [int]$Port = 8097,
  [int]$DbPort = 3409,
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
)

$migrationRel = 'docs/migrations/069_商品SPU增加品牌ID.sql'
$scratch = Join-Path $env:TEMP "s3234-boot-069-$Mode"
$migDir = Join-Path $scratch 'docs\migrations'
if (Test-Path $scratch) { Remove-Item -LiteralPath $scratch -Recurse -Force }
New-Item -ItemType Directory -Force -Path $migDir | Out-Null

$target = Join-Path $migDir '069_商品SPU增加品牌ID.sql'
if ($Mode -eq 'original') {
  # 原版 = 该文件在本次工作的基线提交（HEAD）里的内容；修复版尚未提交，故 HEAD 侧必是原版
  $content = & git -C $RepoRoot show "HEAD:$migrationRel"
  if ($LASTEXITCODE -ne 0) { throw "git show 取原版失败" }
  # 不用 Set-Content：PS 5.1 会写 UTF-8 BOM，改用 .NET 明确写「无 BOM」
  [System.IO.File]::WriteAllText($target, (($content -join "`r`n") + "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
} else {
  Copy-Item -LiteralPath (Join-Path $RepoRoot $migrationRel) -Destination $target -Force
}
$lines = (Get-Content -LiteralPath $target).Count
$sha = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.Substring(0, 16)
Write-Output "== 模式=$Mode｜scratch=${scratch}｜069 行数=${lines}｜SHA256(前16)=${sha}"
Write-Output "== 语料目录内容（应只有 069 一个文件）："
Get-ChildItem -LiteralPath $migDir | ForEach-Object { Write-Output "   - $($_.Name)" }

$logFile = Join-Path $scratch 'boot.log'
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
$env:MIGRATION_WRITE_GATE = 'allow'   # 与部署段同口径：部署通道**没有**写闸门，故启动期也放开，才能看到同一条语句的行为

$proc = Start-Process -FilePath 'node' -ArgumentList (Join-Path $RepoRoot 'backend\dist\server.js') `
  -WorkingDirectory $scratch -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $logFile -RedirectStandardError (Join-Path $scratch 'boot.err.log')
Write-Output "== 已启动 server.js（pid=$($proc.Id)，cwd=${scratch}）"

$deadline = (Get-Date).AddSeconds(120)
$done = $false
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 3
  if (Test-Path $logFile) {
    $text = Get-Content -LiteralPath $logFile -Raw -ErrorAction SilentlyContinue
    if ($text -match '所有迁移完成') { $done = $true; break }
    if ($proc.HasExited) { break }
  }
}
Start-Sleep -Seconds 2
if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
Write-Output "== 启动期迁移结束标记（所有迁移完成）：$done｜进程已退出：$($proc.HasExited)"

$text = if (Test-Path $logFile) { Get-Content -LiteralPath $logFile -Raw } else { '' }
Write-Output "== 069 相关日志行："
($text -split "`n") | Where-Object { $_ -match '069|fk_product_spu_brand|brand_id' } | ForEach-Object { Write-Output "   $($_.Trim())" }
Write-Output "== 迁移失败行（[migration] ... 失败）："
$failLines = ($text -split "`n") | Where-Object { $_ -match '\[migration\].*失败' }
if ($failLines) { $failLines | ForEach-Object { Write-Output "   $($_.Trim())" } } else { Write-Output "   （无）" }
Write-Output "== 原始日志：$logFile"
