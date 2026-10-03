<#
  S3-142 真库真后端证据包装脚本（build → 起真实后端 → 跑判定 → 停后端）

  只连本机私有 MariaDB（默认 127.0.0.1:3399 root/空密码），只重建专用库 s3142_verify。
  用法（仓库根执行）：powershell -ExecutionPolicy Bypass -File backend/scripts/s3-142-real-backend.ps1
#>
param(
  [int]$Port = 18142,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$backend = Join-Path $repo "backend"
$evidence = Join-Path ([System.IO.Path]::GetTempPath()) "s3-142-evidence"
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
$serverOut = Join-Path $evidence "server.out.log"
$serverErr = Join-Path $evidence "server.err.log"

Write-Host "【包装】仓库=$repo 端口=$Port 证据目录=$evidence"

if (-not $SkipBuild) {
  Write-Host "【包装】1/4 构建后端（tsc → dist）"
  Push-Location $backend
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  npm run build 2>&1 | Select-Object -Last 2 | ForEach-Object { Write-Host "    $_" }
  $buildExit = $LASTEXITCODE
  $ErrorActionPreference = $prevEap
  Pop-Location
  if ($buildExit -ne 0) { throw "后端构建失败 EXIT=$buildExit" }
}

$env:NODE_ENV = "development"
$env:USE_MOCK_DB = "false"
$env:PORT = "$Port"
$env:HOST = "127.0.0.1"
$env:JWT_SECRET = "s3-142-local-harness-secret"
$env:CSRF_SECRET = "s3-142-local-harness-csrf"
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "3399"
$env:DB_USER = "root"
$env:DB_PASSWORD = ""
$env:DB_NAME = "s3142_verify"
$env:S3_142_PORT = "$Port"
$env:S3_142_EVIDENCE_DIR = $evidence

$proc = $null
try {
  Write-Host "【包装】2/4 重建专用空库（s3142_verify）"
  Push-Location $backend
  node (Join-Path $PSScriptRoot "s3-142-real-backend.mjs") reset
  $resetExit = $LASTEXITCODE
  Pop-Location
  if ($resetExit -ne 0) { throw "reset 阶段失败 EXIT=$resetExit" }

  Write-Host "【包装】3/4 启动真实后端（node dist/server.js，端口 $Port）"
  $proc = Start-Process -FilePath "node" -ArgumentList "dist/server.js" -WorkingDirectory $backend `
    -WindowStyle Hidden -PassThru -RedirectStandardOutput $serverOut -RedirectStandardError $serverErr
  Write-Host "    后端 PID=$($proc.Id)  stdout=$serverOut"

  Write-Host "【包装】4/4 运行判定"
  node (Join-Path $PSScriptRoot "s3-142-real-backend.mjs")
  $harnessExit = $LASTEXITCODE
}
finally {
  if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
  Write-Host "    后端已停止（日志 $serverOut / $serverErr）"
}

Write-Host "【包装】判定 EXIT=$harnessExit（证据目录 $evidence）"
exit $harnessExit
