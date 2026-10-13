<#
  S3-192（B 轨）运行器：真迁移管线 + 真到期作业 + 迁移 199 的写闸门行为
  用法：powershell -File docs/evidence/S3-192/harness/run-pipeline.ps1
  产出：docs/evidence/S3-192/logs/b*.log
#>
param([string]$Port = "3406", [string]$DbName = "s3192_full")

$ErrorActionPreference = "Continue"
$m = "D:\Users\ZXQL\tools\mariadb\mariadb-11.4.5-winx64\bin\mariadb.exe"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
$logs = Join-Path $repo "docs\evidence\S3-192\logs"
New-Item -ItemType Directory -Force -Path $logs | Out-Null
Set-Location $repo

function Sql([string]$text, [string]$logFile) {
  $cmd = '"' + $m + '" --host=127.0.0.1 --port=' + $Port + ' --user=root --skip-ssl --default-character-set=utf8mb4 -e "' +
    $text + '" > "' + (Join-Path $logs $logFile) + '" 2>&1'
  cmd /c $cmd | Out-Null
  Write-Host ("  [sql] exit={0} -> logs/{1}" -f $LASTEXITCODE, $logFile)
}

Write-Host "[S3-192] B 轨开始 $(Get-Date -Format o)"
Sql ("DROP DATABASE IF EXISTS {0}; CREATE DATABASE {0} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;" -f $DbName) "b0-create-db.log"

Write-Host "① 用产品迁移管线建结构（写闸门=默认 block）"
cmd /c "node docs\evidence\S3-192\harness\05-run-product-migrations.mjs > `"$logs\b1-migrate-gate-block.log`" 2>&1"
Write-Host ("  [migrate/block] exit={0}" -f $LASTEXITCODE)

Write-Host "② 复位后再跑一次（写闸门=allow）；结构语句本就幂等，199 的数据订正只在 allow 下不跳过"
Sql ("DROP DATABASE IF EXISTS {0}; CREATE DATABASE {0} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;" -f $DbName) "b2-create-db-again.log"
$env:MIGRATION_WRITE_GATE = "allow"
cmd /c "node docs\evidence\S3-192\harness\05-run-product-migrations.mjs > `"$logs\b3-migrate-gate-allow.log`" 2>&1"
Write-Host ("  [migrate/allow] exit={0}" -f $LASTEXITCODE)
Remove-Item Env:\MIGRATION_WRITE_GATE -ErrorAction SilentlyContinue

Write-Host "③ 真库结构读数：t_tenant.status 的真实类型"
Sql ("USE {0}; SHOW COLUMNS FROM t_tenant;" -f $DbName) "b4-show-columns-t_tenant.log"

Write-Host "④ 真到期作业：到期 ⇒ 租户被停用（业务结果）"
cmd /c "node docs\evidence\S3-192\harness\06-runtime-expiry.mjs > `"$logs\b5-runtime-expiry.log`" 2>&1"
Write-Host ("  [runtime-expiry] exit={0}" -f $LASTEXITCODE)

Write-Host "⑤ 订正对象与目标行读数（只读）"
Sql ("USE {0}; SELECT COUNT(*) AS status1_rows FROM t_tenant WHERE status = 1;" -f $DbName) "b6-read-active-count.log"
Write-Host "[S3-192] B 轨结束 $(Get-Date -Format o)"
