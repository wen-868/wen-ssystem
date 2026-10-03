# S3-160 运行期证据：构建 → 起真后端（USE_MOCK_DB=true）→ 跑装置 → 关停
#
# 用法（仓库根或任意目录均可）：
#   powershell -ExecutionPolicy Bypass -File backend/scripts/s3-160-remember-me.ps1
# 反测（把默认 TTL 故意改成 30d 后跑）：S3_160_ONLY=缺省-不带rememberMe 时应当变红
#
# 说明：本沙箱无 MySQL/docker，装置用项目自带的 mock 数据库通道（USE_MOCK_DB=true，CI/本地联调同一通道），
#       其余（Express 路由、controller、service、真实 signToken、真实 JWT）全部是生产代码。
$ErrorActionPreference = "Stop"
$BackendDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$RepoRoot = Resolve-Path (Join-Path $BackendDir "..")

# 前置：18160 必须空闲（否则会误连上一台遗留后端，取到旧构建的行为 —— 实测踩过一次）
# 用 netstat 而非 Get-NetTCPConnection：后者在本沙箱对遗留进程的监听口读不到（返回空，误判空闲）
$busy = netstat -ano | Select-String -Pattern ":18160\s+.*LISTENING"
if ($busy) {
  throw "端口 18160 已被占用：$($busy.Line.Trim())，请先关停遗留后端再跑本装置"
}

Push-Location $BackendDir
$serverProcess = $null
$deviceExit = 1
$srvOut = Join-Path $env:TEMP "s3-160-server.out.log"
$srvErr = Join-Path $env:TEMP "s3-160-server.err.log"
try {
  Write-Host "[1/4] tsc 构建 dist ..."
  npx tsc -p tsconfig.json
  if ($LASTEXITCODE -ne 0) { throw "tsc 构建失败（EXIT=$LASTEXITCODE）" }
  node (Join-Path $RepoRoot "scripts/fix-esm-extensions.js") dist | Out-Null

  $env:USE_MOCK_DB = "true"
  $env:NODE_ENV = "development"
  $env:HOST = "127.0.0.1"
  $env:PORT = "18160"
  $env:JWT_SECRET = "s3-160-evidence-secret"

  Write-Host "[2/4] 启动真实后端 http://127.0.0.1:18160 ..."
  $serverProcess = Start-Process -FilePath "node" -ArgumentList "dist/server.js" `
    -PassThru -WindowStyle Hidden -RedirectStandardOutput $srvOut `
    -RedirectStandardError $srvErr

  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:18160/health" -TimeoutSec 2
      if ($health) { $ready = $true; break }
    } catch { }
  }
  if (-not $ready) { throw "后端 20 秒内未就绪，见 $srvErr" }

  Write-Host "[3/4] 运行装置 ..."
  node scripts/s3-160-remember-me.mjs
  $deviceExit = $LASTEXITCODE
}
finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Write-Host "[4/4] 关停后端 ..."
    Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
  }
  Pop-Location
}

exit $deviceExit
