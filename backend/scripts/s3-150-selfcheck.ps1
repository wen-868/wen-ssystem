<#
  S3-150 自检驱动（起私有 MariaDB → 跑自检/反测 → 落证据 → 收实例）

  为什么不让 node 自己起库：与凌舟 S3-109 的做法保持一致（mariadb-install-db + mysqld --port），
  实例 datadir 放在 %TEMP%，**不触碰任何既有实例**（本机 3306 上的实例不被使用）。

  用法：
    pwsh -NoProfile -File backend/scripts/s3-150-selfcheck.ps1            # 正测 + 反测，证据落 S3-150-待落盘/evidence/
    pwsh -NoProfile -File backend/scripts/s3-150-selfcheck.ps1 -Port 3401

  退出码：正测与反测都符合预期 ⇒ 0；否则 1。
#>
param(
  [int]$Port = 3399,
  [string]$EvidenceDir = ""
)
$ErrorActionPreference = "Continue"

$bin = "D:\Users\ZXQL\tools\mariadb\mariadb-11.4.5-winx64\bin"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if (-not $EvidenceDir) { $EvidenceDir = Join-Path $repo "S3-150-待落盘\evidence" }
New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null

$root = Join-Path $env:TEMP ("s3-150-mdb-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Force -Path (Join-Path $root "data") | Out-Null

$log = New-Object System.Collections.Generic.List[string]
$log.Add("# S3-150 自检/反测（私有 MariaDB @127.0.0.1:$Port，datadir=$root）")
$log.Add("# 时间：" + (Get-Date -Format "s"))

& "$bin\mariadb-install-db.exe" "--datadir=$root\data" --default-user *> (Join-Path $root "install.log")
$log.Add("mariadb-install-db exit=" + $LASTEXITCODE)

$proc = Start-Process "$bin\mysqld.exe" -WindowStyle Hidden -PassThru -ArgumentList @(
  "--datadir=$root\data", "--port=$Port", "--bind-address=127.0.0.1", "--ssl=0",
  "--skip-name-resolve", "--plugin-dir=$bin\..\lib\plugin", "--console"
) -RedirectStandardOutput (Join-Path $root "mysqld.log") -RedirectStandardError (Join-Path $root "mysqld.err.log")
$log.Add("mysqld pid=" + $proc.Id)
Start-Sleep -Seconds 12

$harness = Join-Path $repo "backend\scripts\s3-150-selfcheck.cjs"
$positiveExpect = 0
$negativeExpect = 0
try {
  $log.Add("")
  $log.Add("## 正测（期望 SUMMARY 全 PASS，EXIT=0）")
  $positive = (& node $harness --db-port $Port 2>&1) -join "`r`n"
  $positiveExit = $LASTEXITCODE
  $log.Add($positive)
  $log.Add("POSITIVE_EXIT=$positiveExit")

  $log.Add("")
  $log.Add("## 反测（S3_150_NEGATIVE_TEST=1，期望 1366 + 端点 500，EXIT=0）")
  $env:S3_150_NEGATIVE_TEST = "1"
  $negative = (& node $harness --db-port $Port 2>&1) -join "`r`n"
  $negativeExit = $LASTEXITCODE
  Remove-Item Env:\S3_150_NEGATIVE_TEST -ErrorAction SilentlyContinue
  $log.Add($negative)
  $log.Add("NEGATIVE_EXIT=$negativeExit")
} finally {
  if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue; $log.Add("mysqld stopped") }
}

$outFile = Join-Path $EvidenceDir "s3-150-selfcheck-run.txt"
$log -join "`r`n" | Set-Content -LiteralPath $outFile -Encoding UTF8

Write-Host "=== 正测关键行 ==="
$log | Select-String -Pattern "^(PASS|FAIL|SUMMARY)|^环境：|^反测模式|原始输出：|丢弃" | Select-Object -First 60 | ForEach-Object { $_.Line }
Write-Host "=== 结论 ==="
Write-Host ("正测 EXIT=" + $positiveExit + " / 反测 EXIT=" + $negativeExit)
Write-Host ("证据文件：" + $outFile)
# 预期：正测 EXIT=0；反测 EXIT=0（反测模式内部断言 1366 与 500 都命中才算 PASS）
if ($positiveExit -eq $positiveExpect -and $negativeExit -eq $negativeExpect) { exit 0 } else { exit 1 }
