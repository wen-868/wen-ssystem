# S3-235 反测装置：证明 205 的"幂等 + 非破坏"断言有分辨力（会在该红的地方红）
#
# 反测对象（逐条对应卡面 R1/R2/R3 的判据）：
#   T1 sentinel 非破坏：已有非空 permissions（人为改成 ["__sentinel__"]）⇒ 跑 205 后**一个字节都不改**
#   T2 NULL 恢复      ：permissions=NULL ⇒ 跑 205 后回落为底稿值
#   T3 空数组恢复     ：permissions='[]' ⇒ 跑 205 后回落为底稿值
#   T4 行缺失补建     ：删掉角色行 ⇒ 跑 205 后按底稿重建
#   T5 自检 PASS      ：R3 只读自检在"有权限"时输出 PASS
#   T6 自检 FAIL      ：人为把"在用角色"清空 ⇒ R3 自检输出 FAIL（非 0）；跑 205 复原后回到 PASS
#
# 用法（仓库根执行，需要本机夹具库；**不要对着生产跑**）：
#   powershell -NoProfile -File docs/evidence/S3-235/tools/reverse-tests.ps1 -DbName liq235_probe
param(
  [string]$DbName = "liq235_probe",
  [int]$Port = 3421
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
$raw = Join-Path $root "docs\evidence\S3-235\raw"
$base = Join-Path $env:TEMP "mysql80\mysql-8.0.28-winx64"
$mysql = Join-Path $base "bin\mysql.exe"

$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "$Port"
$env:DB_USER = "root"
$env:DB_NAME = $DbName

function Invoke-Sql([string]$sql) {
  # 走 stdin 下发（而不是 -e）：SQL 里要同时出现单引号与双引号（JSON 字面量），-e 会被 PowerShell 的引号规则搅乱
  $sql | & $mysql --protocol=TCP --host=127.0.0.1 --port=$Port --user=root --table $DbName 2>&1
}
function Show-Role([string]$code) {
  Invoke-Sql "SELECT role_code, permissions, JSON_LENGTH(permissions) AS len FROM t_sys_role WHERE tenant_id='default' AND role_code='$code';"
}
function Run-205() {
  Push-Location $root
  try { node "docs/evidence/S3-235/tools/run-205-idempotency.mjs" "docs/migrations/205_角色权限种子.sql" 2>&1 | Select-String -Pattern "命中行|判定|statement|affectedRows|changedRows" }
  finally { Pop-Location }
}
function Assert([string]$name, [bool]$ok) {
  Write-Output ("[{0}] {1}" -f ($(if ($ok) { "PASS" } else { "FAIL" })), $name)
}

# ---------- T1 sentinel ----------
Invoke-Sql (@'
UPDATE t_sys_role SET permissions = JSON_ARRAY('__sentinel__') WHERE tenant_id='default' AND role_code='STORE_MANAGER';
'@) | Out-Null
$before = (Invoke-Sql "SELECT permissions FROM t_sys_role WHERE tenant_id='default' AND role_code='STORE_MANAGER';") -join " "
$run1 = (Run-205) -join "`n"
$after = (Invoke-Sql "SELECT permissions FROM t_sys_role WHERE tenant_id='default' AND role_code='STORE_MANAGER';") -join " "
$t1 = ($run1 -match "命中行（affectedRows>0 或 changedRows>0）的语句 = 0 条") -and ($before -eq $after)
$t1block = @("=== T1 sentinel 非破坏 ===", "改前: $before", $run1, "改后: $after", "断言(0 命中 且 值不变): $(if ($t1) { 'PASS' } else { 'FAIL' })")
$t1block | Set-Content -LiteralPath (Join-Path $raw "61-sentinel-nondestructive.txt") -Encoding UTF8
$t1block | ForEach-Object { Write-Output $_ }

# ---------- T2 NULL 恢复 ----------
Invoke-Sql "UPDATE t_sys_role SET permissions=NULL WHERE tenant_id='default' AND role_code='STORE_MANAGER';" | Out-Null
$run2 = (Run-205) -join "`n"
$after2 = (Show-Role "STORE_MANAGER") -join " "
$t2 = ($run2 -match "本遍有变更") -and ($after2 -match 'finance:payment')
$t2block = @("=== T2 NULL 恢复 ===", $run2, $after2, "断言(有变更 且 回落到底稿值): $(if ($t2) { 'PASS' } else { 'FAIL' })")
$t2block | Set-Content -LiteralPath (Join-Path $raw "62-null-restore.txt") -Encoding UTF8
$t2block | ForEach-Object { Write-Output $_ }

# ---------- T3 空数组恢复 ----------
Invoke-Sql "UPDATE t_sys_role SET permissions='[]' WHERE tenant_id='default' AND role_code='SALESMAN';" | Out-Null
$run3 = (Run-205) -join "`n"
$after3 = (Show-Role "SALESMAN") -join " "
$t3 = ($run3 -match "本遍有变更") -and ($after3 -match 'customer:write')
$t3block = @("=== T3 空数组恢复 ===", $run3, $after3, "断言(有变更 且 回落到销售员底稿值): $(if ($t3) { 'PASS' } else { 'FAIL' })")
$t3block | Set-Content -LiteralPath (Join-Path $raw "63-empty-array-restore.txt") -Encoding UTF8
$t3block | ForEach-Object { Write-Output $_ }

# ---------- T4 行缺失补建 ----------
Invoke-Sql "DELETE FROM t_sys_role WHERE tenant_id='default' AND role_code='SALESMAN';" | Out-Null
$run4 = (Run-205) -join "`n"
$after4 = (Show-Role "SALESMAN") -join " "
$t4 = ($run4 -match "本遍有变更") -and ($after4 -match 'customer:write')
$t4block = @("=== T4 行缺失补建 ===", $run4, $after4, "断言(有变更 且 行被按底稿重建): $(if ($t4) { 'PASS' } else { 'FAIL' })")
$t4block | Set-Content -LiteralPath (Join-Path $raw "64-missing-row-insert.txt") -Encoding UTF8
$t4block | ForEach-Object { Write-Output $_ }

# ---------- T5 自检 PASS ----------
Push-Location $root
try { $t5out = (node "docs/evidence/S3-235/tools/run-205-idempotency.mjs" "docs/evidence/S3-235/tools/role-seed-selfcheck.sql" 2>&1) -join "`n" }
finally { Pop-Location }
$t5 = $t5out -match "PASS: 在用角色"
$t5block = @("=== T5 R3 自检（有权限 ⇒ PASS） ===", $t5out, "断言(PASS): $(if ($t5) { 'PASS' } else { 'FAIL' })")
$t5block | Set-Content -LiteralPath (Join-Path $raw "65-selfcheck-pass.txt") -Encoding UTF8
$t5block | ForEach-Object { Write-Output $_ }

# ---------- T6 自检 FAIL（在用角色被清空） + 跑 205 复原 ----------
Invoke-Sql "UPDATE t_sys_role r SET r.permissions=NULL WHERE r.tenant_id='default' AND r.role_code='STORE_MANAGER' AND EXISTS (SELECT 1 FROM t_sys_user_role ur WHERE ur.role_id=r.id);" | Out-Null
Push-Location $root
try { $t6red = (node "docs/evidence/S3-235/tools/run-205-idempotency.mjs" "docs/evidence/S3-235/tools/role-seed-selfcheck.sql" 2>&1) -join "`n" }
finally { Pop-Location }
$t6fail = $t6red -match "FAIL: 在用角色"
Run-205 | Out-Null
Push-Location $root
try { $t6green = (node "docs/evidence/S3-235/tools/run-205-idempotency.mjs" "docs/evidence/S3-235/tools/role-seed-selfcheck.sql" 2>&1) -join "`n" }
finally { Pop-Location }
$t6back = $t6green -match "PASS: 在用角色"
$t6block = @(
  "=== T6 R3 自检（人在用角色被清空 ⇒ FAIL；跑 205 后 ⇒ PASS）===",
  "--- 清空后 ---", $t6red,
  "--- 跑 205 复原后 ---", $t6green,
  "断言(先 FAIL 后 PASS): $(if ($t6fail -and $t6back) { 'PASS' } else { 'FAIL' })"
)
$t6block | Set-Content -LiteralPath (Join-Path $raw "66-selfcheck-fail-then-restore.txt") -Encoding UTF8
$t6block | ForEach-Object { Write-Output $_ }

Write-Output ""
Assert "T1 sentinel 非破坏" $t1
Assert "T2 NULL 恢复" $t2
Assert "T3 空数组恢复" $t3
Assert "T4 行缺失补建" $t4
Assert "T5 自检 PASS" $t5
Assert "T6 自检 FAIL→复原 PASS" ($t6fail -and $t6back)
