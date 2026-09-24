# S3-67 一键复跑（D2 派单卡交付物 6）
#
# 步骤：起 mock 后端(8081) + admin-web dev(5173) → 等就绪 → 跑静态清点 + 运行期 computed 探针 → 收服务
# 产物：docs/evidence/S3-67/raw/**（原始 JSON/TXT/日志）+ raw/screenshots/**
#
# 用法（PowerShell）：powershell -ExecutionPolicy Bypass -File docs/evidence/S3-67/tools/s3-67-run-all.ps1
# 说明：本脚本**只读业务代码**，不写 admin-web/src；只往 docs/evidence/S3-67/raw 落盘。

$ErrorActionPreference = 'Stop'
$wt = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
$tools = $PSScriptRoot
$raw = Join-Path $wt 'docs\evidence\S3-67\raw'
$logs = Join-Path $raw 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

Write-Host "[1/5] 检查依赖 junction（无网环境，依赖复用主仓）"
foreach ($rel in @('node_modules', 'admin-web\node_modules', 'backend\node_modules')) {
  $p = Join-Path $wt $rel
  if (-not (Test-Path $p)) { throw "缺少依赖目录：$p（请按 README 建 junction 到主仓 node_modules）" }
}

Write-Host "[2/5] 起 mock 后端 8081 + admin-web dev 5173"
$mockLog = Join-Path $logs 'mock-backend.log'
$adminLog = Join-Path $logs 'admin-web-dev.log'
$mock = Start-Process -FilePath (Get-Command node).Source -ArgumentList @((Join-Path $tools 's3-67-start-mock.cjs')) `
  -WorkingDirectory $wt -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $mockLog -RedirectStandardError (Join-Path $logs 'mock-backend.err.log')
$admin = Start-Process -FilePath (Get-Command node).Source -ArgumentList @((Join-Path $tools 's3-67-start-admin.cjs')) `
  -WorkingDirectory $wt -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $adminLog -RedirectStandardError (Join-Path $logs 'admin-web-dev.err.log')
Write-Host ("      mock pid={0}  admin pid={1}" -f $mock.Id, $admin.Id)

try {
  Write-Host "[3/5] 等待服务就绪（8081 / 5173）"
  $ok = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    $p1 = (Test-NetConnection -ComputerName 127.0.0.1 -Port 8081 -InformationLevel Quiet -WarningAction SilentlyContinue)
    $p2 = (Test-NetConnection -ComputerName 127.0.0.1 -Port 5173 -InformationLevel Quiet -WarningAction SilentlyContinue)
    if ($p1 -and $p2) { $ok = $true; break }
  }
  if (-not $ok) { throw "服务未就绪：8081=$p1 5173=$p2（见 $logs）" }
  Write-Host "      就绪"

  Write-Host "[4/5] 静态清点"
  node (Join-Path $tools 's3-67-static-inventory.mjs') *>&1 | Tee-Object (Join-Path $raw 'static-inventory-run.log') | Select-Object -Last 12

  Write-Host "[5/5] 运行期 computed 矩阵探针（基线 + 6 变量哨兵轮）"
  node (Join-Path $tools 's3-67-computed-matrix.cjs') firefox *>&1 | Tee-Object (Join-Path $raw 'computed-probe-run.log') | Select-Object -Last 25
}
finally {
  Write-Host "收服务（mock / admin-web dev）"
  foreach ($p in @($admin, $mock)) {
    if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
  }
  # vite/tsx 会派生子进程，按命令行特征兜底清理（只匹配本 worktree 路径）
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*wt-agents\issue-97*" -and ($_.CommandLine -like '*vite*' -or $_.CommandLine -like '*server.ts*') } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

Write-Host "完成：产物在 $raw"
