# S3-50 反测 RT-C：E2E 密闭性取证（S3-59.1）step 8 的断言有没有分辨力
#
# 被检对象：e2e.yml job e2e step 8「密闭性取证（S3-59.1）：/api 必须打到 mock，不得回落生产」
#   该步骤三条断言：
#     ① 直连 mock：curl 127.0.0.1:8080/api/platform/health 响应含 "mode":"mock-db"
#     ② 经 admin-web dev server(5173) 代理，同样须含该标记
#     ③ 登录探针请求落到 mock 后端日志：grep "[mock-request] POST /api/admin/auth/login"
#
# 方法（驱动真实后端进程，仓库工作区零改动）：
#   起 backend/dist/server.js（USE_MOCK_DB=true）→ 真实 HTTP 请求 → 对真实响应/真实日志做断言；
#   并做负对照：把响应里的 mock 标记抹掉后重跑同一条断言，必须失败。
#
# 未覆盖（如实记账）：断言② 需要 vite dev server，本反测未起。
# 复跑（需先 npm --workspace backend run build）：pwsh -File docs/evidence/S3-50/tools/rt-c-seal-probe.ps1

$ErrorActionPreference = 'Continue'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
$server = Join-Path $root 'backend\dist\server.js'
$port = 18095
$base = "http://127.0.0.1:$port"
$logFile = Join-Path ([IO.Path]::GetTempPath()) ("s3-50-rtC-backend-" + [guid]::NewGuid().ToString('N') + '.log')

function Test-MockMarker([string]$body) { return $body.Contains('"mode":"mock-db"') }

Write-Output '=====================  S3-50 RT-C  E2E 密闭性取证反测  ====================='
Write-Output "后端进程：backend/dist/server.js  USE_MOCK_DB=true  PORT=$port"
Write-Output "后端日志：$logFile"
Write-Output ''

if (-not (Test-Path -LiteralPath $server)) {
  Write-Output '❌ 后端 dist 不存在（需先 npm --workspace backend run build）—— 本反测不成立，记环境阻塞'
  exit 1
}

$proc = Start-Process -FilePath 'node' -ArgumentList $server -PassThru -WindowStyle Hidden `
  -WorkingDirectory (Join-Path $root 'backend') `
  -RedirectStandardOutput $logFile -RedirectStandardError ($logFile + '.err') `
  -Environment @{
    USE_MOCK_DB  = 'true'
    NODE_ENV     = 'development'
    JWT_SECRET   = 'rt-c-seal-secret'
    PORT         = "$port"
  }

try {
  $up = $false
  for ($i = 0; $i -lt 120; $i++) {
    Start-Sleep -Milliseconds 500
    try { $null = Invoke-WebRequest -Uri "$base/health" -TimeoutSec 2; $up = $true; break } catch { }
  }
  Write-Output ("--- 启动等待（等价 CI 的 wait-on http://127.0.0.1:8080/health）: " + $(if ($up) { 'up' } else { 'TIMEOUT' }) + ' ---')
  if (-not $up) {
    Write-Output '❌ 后端未能起来，本反测无法成立（记环境阻塞，不写成结论）'
    exit 1
  }

  $resp = Invoke-WebRequest -Uri "$base/api/platform/health" -TimeoutSec 10
  $body = $resp.Content
  Write-Output "--- 断言① 直连 mock：GET /api/platform/health -> HTTP $($resp.StatusCode) ---"
  Write-Output ("响应体: " + $body.Substring(0, [Math]::Min(200, $body.Length)))
  if (Test-MockMarker $body) { Write-Output '✅ 断言① 通过：响应含 "mode":"mock-db"（实证确实打到 mock 后端）' }
  else { Write-Output '❌ 断言① 失败：响应不含 mock 标记' }

  Write-Output ''
  Write-Output '--- 断言① 负对照：抹掉 mock 标记后重跑同一条断言（期望失败）---'
  $tampered = $body.Replace('"mode":"mock-db"', '"mode":"production"')
  if (-not (Test-MockMarker $tampered)) { Write-Output '✅ 负对照通过：标记被抹掉时断言失败 ⇒ 该断言有分辨力（不是恒真）' }
  else { Write-Output '❌ 负对照失败：断言恒真 ⇒ 假门禁' }

  Write-Output ''
  Write-Output '--- 断言③ 登录探针落到 mock 后端日志 ---'
  try {
    $login = Invoke-WebRequest -Uri "$base/api/admin/auth/login" -Method POST -TimeoutSec 15 `
      -ContentType 'application/json' `
      -Body '{"username":"s3-50-rt-c-probe","password":"s3-50-rt-c-probe"}'
    Write-Output "POST /api/admin/auth/login -> HTTP $($login.StatusCode)"
  } catch {
    Write-Output "POST /api/admin/auth/login -> 异常（仍继续查日志）: $($_.Exception.Message)"
  }
  Start-Sleep -Seconds 2
  $log = if (Test-Path -LiteralPath $logFile) { Get-Content -LiteralPath $logFile -Raw } else { '' }
  $count = ([regex]::Matches($log, '\[mock-request\]')).Count
  Write-Output "日志中 [mock-request] 计数: $count"
  if ($log.Contains('[mock-request] POST /api/admin/auth/login')) {
    Write-Output '✅ 断言③ 通过：mock 后端确实收到登录请求（该日志仅 USE_MOCK_DB 下挂载）'
  } else {
    Write-Output '❌ 断言③ 失败：日志未见该请求'
  }
  Write-Output ''
  Write-Output '未覆盖（如实记账）：CI 里的断言②「经 admin-web dev server 5173 代理」需要 vite dev server，本反测未起 ⇒ 该条仍属未闭环（见未闭环清单 #4）。'
} finally {
  if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
}

Write-Output ''
Write-Output '=====================  RT-C 结束  ====================='
