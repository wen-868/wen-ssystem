# S3-50 反测 RT-B：wait-on 的失败路径（真实 wait-on 包）
#
# 被检对象：
#   ci.yml  build-and-test step 16 Wait for backend
#     run: npx wait-on -t 90000 http://127.0.0.1:8080/health || (echo ...; cat ...; exit 1)
#   e2e.yml 两个 job 里起 dev server 后的 npx wait-on ...
#
# 判据：该步骤「能红」的前提是 wait-on 在端口无监听时必须非零退出。
#   A) 探无人监听的端口   -> 期望 exit != 0
#   B) 起真实临时 HTTP 服务 -> 期望 exit 0（证明不是恒红）
#
# 复跑：pwsh -File docs/evidence/S3-50/tools/rt-b-wait-on-failure.ps1

$ErrorActionPreference = 'Continue'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
$waitOn = Join-Path $root 'node_modules\wait-on\bin\wait-on'
$tmpBase = [IO.Path]::GetTempPath()

function Invoke-WaitOn([string]$url, [int]$timeoutMs) {
  $out = & node $waitOn -t $timeoutMs $url 2>&1 | Out-String
  return @{ code = $LASTEXITCODE; out = $out }
}

Write-Output '=====================  S3-50 RT-B  wait-on 失败路径反测  ====================='
Write-Output 'wait-on 二进制：node_modules/wait-on/bin/wait-on（与 CI 上 npx wait-on 同一 npm 包）'
Write-Output ''

$dead = 'http://127.0.0.1:59997/health'
Write-Output '--- A) 探无人监听的端口（期望 exit != 0，兜底会判红）---'
$r = Invoke-WaitOn $dead 3000
Write-Output ("url=$dead  exit=" + $r.code)
Write-Output ('输出首行: ' + (($r.out -split "`r?`n" | Where-Object { $_ -ne '' } | Select-Object -First 1)))
if ($r.code -ne 0) { Write-Output '通过：wait-on 非零退出，兜底会把该步骤判红' }
else { Write-Output '失败：wait-on 在死端口上仍返回 0，该步骤永远绿（假门禁）' }
Write-Output ''

# B) 起一个真实临时 HTTP 服务（后台 node 脚本），再探
$serverScript = Join-Path $tmpBase ("s3-50-rtB-server-" + [guid]::NewGuid().ToString('N') + '.mjs')
@'
import http from "node:http";
const port = Number(process.argv[2]);
http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end('{"status":"healthy"}');
}).listen(port, "127.0.0.1", () => console.log("listening " + port));
'@ | Set-Content -LiteralPath $serverScript -Encoding utf8

$port = 18097
$proc = Start-Process -FilePath 'node' -ArgumentList $serverScript, $port -PassThru -WindowStyle Hidden
try {
  $up = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 250
    try { $null = Invoke-WebRequest -Uri "http://127.0.0.1:$port/health" -TimeoutSec 2; $up = $true; break } catch { }
  }
  Write-Output '--- B) 起真实临时服务再探（期望 exit 0，证明不是恒红）---'
  if (-not $up) { Write-Output '失败：临时服务未起来，本反测不成立' }
  else {
    $live = "http://127.0.0.1:$port/health"
    $r = Invoke-WaitOn $live 10000
    Write-Output ("url=$live  exit=" + $r.code)
    Write-Output ('输出首行: ' + (($r.out -split "`r?`n" | Where-Object { $_ -ne '' } | Select-Object -First 1)))
    if ($r.code -eq 0) { Write-Output '通过：可达时 exit 0，该检查有分辨力（能红也能绿）' }
    else { Write-Output '失败：可达时仍非零' }
  }
} finally {
  if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
  Remove-Item -LiteralPath $serverScript -Force -ErrorAction SilentlyContinue
}

Write-Output ''
Write-Output '=====================  RT-B 结束  ====================='
