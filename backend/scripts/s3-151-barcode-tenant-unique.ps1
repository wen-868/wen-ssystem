<#
  S3-151 运行期装置包装脚本（build → 起真实后端 → 跑判定 → 停后端）

  为什么需要包装脚本：本沙箱里 node 不能创建子进程（child_process.spawn ⇒ EPERM，实测），
  装置本身拉不起后端；由 PowerShell 负责进程生命周期，判定逻辑仍在
  scripts/s3-151-barcode-tenant-unique.mjs 里。

  用法（在仓库根执行）：
    powershell -ExecutionPolicy Bypass -File backend/scripts/s3-151-barcode-tenant-unique.ps1 -Mode green
    powershell -ExecutionPolicy Bypass -File backend/scripts/s3-151-barcode-tenant-unique.ps1 -Mode revert
    # 可选：-SkipBuild（dist 已是最新时）

  只连本机私有 MariaDB（默认 127.0.0.1:3399 root/空密码），并只重建专用库 s3151_verify。
#>
param(
  [ValidateSet("green", "revert")]
  [string]$Mode = "green",
  [switch]$SkipBuild,
  [int]$Port = 18151
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$backend = Join-Path $repo "backend"
$evidence = Join-Path ([System.IO.Path]::GetTempPath()) "s3-151-evidence"
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
$serverOut = Join-Path $evidence "server-$Mode.out.log"
$serverErr = Join-Path $evidence "server-$Mode.err.log"
$serverLog = Join-Path $evidence "server-$Mode.log"

Write-Host "【包装】仓库=$repo 模式=$Mode 端口=$Port 证据目录=$evidence"

if (-not $SkipBuild) {
  Write-Host "【包装】1/5 构建后端（tsc → dist）"
  Push-Location $backend
  # tsc 在 stderr 上的 MODULE_TYPELESS_PACKAGE_JSON 警告会被 PS7 当 NativeCommandError；
  # 构建设置为 Continue，只看 $LASTEXITCODE，避免被警告中断
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  npm run build 2>&1 | Select-Object -Last 3 | ForEach-Object { Write-Host "    $_" }
  $buildExit = $LASTEXITCODE
  $ErrorActionPreference = $prevEap
  Pop-Location
  if ($buildExit -ne 0) { throw "后端构建失败 EXIT=$buildExit" }
}

# 环境变量：子进程继承（后端启动 + 装置共用同一套）
$env:NODE_ENV = "development"
$env:USE_MOCK_DB = "false"
$env:PORT = "$Port"
$env:HOST = "127.0.0.1"
$env:JWT_SECRET = "s3-151-local-harness-secret"
$env:CSRF_SECRET = "s3-151-local-harness-csrf"
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "3399"
$env:DB_USER = "root"
$env:DB_PASSWORD = ""
$env:DB_NAME = "s3151_verify"
$env:S3_151_PORT = "$Port"
$env:S3_151_SERVER_OUT = $serverOut
$env:S3_151_SERVER_ERR = $serverErr
$env:S3_151_EVIDENCE_DIR = $evidence

try {
  Write-Host "【包装】2/5 重建专用空库（s3151_verify）"
  node (Join-Path $PSScriptRoot "s3-151-barcode-tenant-unique.mjs") reset
  if ($LASTEXITCODE -ne 0) { throw "reset 阶段失败 EXIT=$LASTEXITCODE" }

  Write-Host "【包装】3/5 启动真实后端（node dist/server.js，端口 $Port）"
  $proc = Start-Process -FilePath "node" -ArgumentList "dist/server.js" -WorkingDirectory $backend `
    -WindowStyle Hidden -PassThru -RedirectStandardOutput $serverOut -RedirectStandardError $serverErr
  Write-Host "    后端 PID=$($proc.Id)  stdout=$serverOut  stderr=$serverErr"

  Write-Host "【包装】4/5 运行判定（phase=$Mode）"
  node (Join-Path $PSScriptRoot "s3-151-barcode-tenant-unique.mjs") $(if ($Mode -eq "green") { "verify" } else { "revert" })
  $harnessExit = $LASTEXITCODE
}
finally {
  Write-Host "【包装】5/5 停止后端"
  if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
  # 后端日志合并落盘（stdout + stderr），供判定脚本核对"执行外部迁移: 194"一行
  $merged = @()
  if (Test-Path $serverOut) { $merged += Get-Content $serverOut -Raw }
  if (Test-Path $serverErr) { $merged += Get-Content $serverErr -Raw }
  ($merged -join "`n") | Set-Content -Path $serverLog -Encoding UTF8
  Write-Host "    后端日志合并到 $serverLog（$((Get-Item $serverLog).Length) 字节）"
}

# 判定脚本在 verify 阶段需要读后端日志来核对迁移 194 已执行——日志在 verify 结束后才合并，
# 因此这里再补一次"日志核对"（同一判据，读取已合并的 server-<mode>.log）
$migHit = Select-String -Path $serverLog -Pattern "执行外部迁移: 194_条码唯一键改租户内唯一.sql" -SimpleMatch -Quiet
Write-Host "【包装】后端日志中迁移 194 执行行：$(if ($migHit) { '命中' } else { '未命中' })"

Write-Host "【包装】判定 EXIT=$harnessExit（证据目录 $evidence）"
exit $harnessExit
