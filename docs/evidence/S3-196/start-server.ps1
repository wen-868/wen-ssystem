<#
  S3-196 · 起一个「真产物 + 真库」后端实例（本机私有 MariaDB 3406 上的独立 scratch 库）。
  用法：pwsh -File start-server.ps1 -Worktree <路径> -DbName <库名> -Port <端口> -LogPrefix <前缀>
  红线：只对本单自建 scratch 库（s3196_e2e*）操作；不碰业务库/生产库。
#>
param(
  [Parameter(Mandatory = $true)][string]$Worktree,
  [Parameter(Mandatory = $true)][string]$DbName,
  [Parameter(Mandatory = $true)][int]$Port,
  [Parameter(Mandatory = $true)][string]$LogPrefix
)

$ErrorActionPreference = 'Stop'
$evDir = Join-Path $Worktree 'docs\evidence\S3-196'

$env:NODE_ENV = 'development'
$env:PORT = "$Port"
$env:USE_MOCK_DB = 'false'
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '3406'
$env:DB_USER = 'root'
$env:DB_PASSWORD = ''
$env:DB_NAME = $DbName
$env:JWT_SECRET = 's3196-e2e-jwt-secret'
$env:CSRF_SECRET = 's3196-e2e-csrf-secret'
$env:LOG_LEVEL = 'info'
$env:REDIS_HOST = '127.0.0.1'
$env:REDIS_PORT = '6399'

$out = Join-Path $evDir "$LogPrefix.out.log"
$err = Join-Path $evDir "$LogPrefix.err.log"
$proc = Start-Process -FilePath 'node' -ArgumentList 'dist/server.js' `
  -WorkingDirectory (Join-Path $Worktree 'backend') -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $out -RedirectStandardError $err

"$($proc.Id)" | Set-Content -Path (Join-Path $evDir "$LogPrefix.pid.txt") -Encoding utf8NoBOM
Write-Output "started pid=$($proc.Id) db=$DbName port=$Port"

$healthy = $false
for ($i = 0; $i -lt 120; $i++) {
  Start-Sleep -Seconds 2
  try {
    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 3 -UseBasicParsing
    if ($resp.StatusCode -eq 200) {
      Write-Output "HEALTH 200: $($resp.Content)"
      $healthy = $true
      break
    }
  } catch {
    # 未起好，继续等
  }
}

if (-not $healthy) {
  Write-Output 'HEALTH TIMEOUT'
  Get-Content -Path $err -Tail 40 -ErrorAction SilentlyContinue
  exit 1
}
