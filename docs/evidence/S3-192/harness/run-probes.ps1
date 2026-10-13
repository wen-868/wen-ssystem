<#
  S3-192 探针运行器（A 轨）：本机私有 MariaDB（127.0.0.1:3406）上按顺序跑全部探针并落日志。
  用法：powershell -File docs/evidence/S3-192/harness/run-probes.ps1
  产出：docs/evidence/S3-192/logs/p*.log（原始 stdout+stderr，未加工）
  说明：库名一律 s3192_*，只碰探针库；不连生产、不写生产。
#>
param([string]$Port = "3406", [string]$DbHost = "127.0.0.1")

$ErrorActionPreference = "Continue"
$m = "D:\Users\ZXQL\tools\mariadb\mariadb-11.4.5-winx64\bin\mariadb.exe"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$h = Join-Path $root "harness"
$logs = Join-Path $root "logs"
New-Item -ItemType Directory -Force -Path $logs | Out-Null

function Run-Sql([string]$sqlFile, [string]$logFile) {
  $cmd = '"' + $m + '" --host=' + $DbHost + ' --port=' + $Port + ' --user=root --skip-ssl --default-character-set=utf8mb4 < "' +
    (Join-Path $h $sqlFile) + '" > "' + (Join-Path $logs $logFile) + '" 2>&1'
  cmd /c $cmd | Out-Null
  $code = $LASTEXITCODE
  Write-Host ("  [{0}] exit={1} -> logs/{2}" -f $sqlFile, $code, $logFile)
}

Write-Host "[S3-192] 探针开始 $(Get-Date -Format o)"
Write-Host "① 建探针库（两种 schema 形态）"
Run-Sql "01-probe-setup.sql" "p01-setup.log"
Write-Host "② 前提订正三条（严格模式 1292 / 严格模式 1366 / 宽松路径隐式转换）"
Run-Sql "02a1-probe-strict-compare.sql" "p02a1-strict-compare.log"
Run-Sql "02a2-probe-strict-set-string.sql" "p02a2-strict-set-string.log"
Run-Sql "02a3-probe-lenient-literal.sql" "p02a3-lenient-literal.log"
Write-Host "③ 重置探针数据后跑修复后语句（数值形态 + 字符串形态 A/B）"
Run-Sql "01-probe-setup.sql" "p01b-setup-reset.log"
Run-Sql "02-probe-premise.sql" "p02-premise.log"
Run-Sql "03-probe-string-shape.sql" "p03-string-shape.log"
Write-Host "④ 迁移 199：订正效果 + 幂等 + 反测（去掉 WHERE）"
Run-Sql "04-probe-199.sql" "p04-probe-199.log"
Write-Host "[S3-192] 探针结束 $(Get-Date -Format o)"
