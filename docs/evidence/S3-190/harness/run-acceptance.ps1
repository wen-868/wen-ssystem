<#
  S3-190 装置⑦（验收总驱动）：把"修复前 / 基线 / 修复后 / F1 反测 / F2 反测"整套跑一遍。

  每个用例都会在日志头部写"输入指纹"（语料 sha + 缺前缀 SET 行数 + migration.ts / dist 的 sha），
  因此"某条结论是哪份输入跑出来的"永远可核对（不会出现"跑错工作树还不知道"）。

  前置：
    ① 两个工作树都已 npx tsc + fix-esm-extensions（装置直接跑 backend/dist/shared/migration.js）；
    ② 本机私有 MariaDB 在 127.0.0.1:3406（见 README §环境）。

  用法：
    powershell -File docs/evidence/S3-190/harness/run-acceptance.ps1 `
      -FixedRepo D:\Users\ZXQL\wt-agents\S3-190 -BaseRepo D:\Users\ZXQL\wt-agents\S3-190-base
#>
param(
  [Parameter(Mandatory = $true)][string]$FixedRepo,
  [Parameter(Mandatory = $true)][string]$BaseRepo,
  [string]$EvidenceDir = "D:\Users\ZXQL\wt-agents\_s3190-evidence\outputs"
)

$ErrorActionPreference = "Stop"
$fixed = (Resolve-Path $FixedRepo).Path
$base = (Resolve-Path $BaseRepo).Path
$harness = Join-Path $fixed "docs\evidence\S3-190\harness"
$out = $EvidenceDir
$repoOut = Join-Path $fixed "docs\evidence\S3-190\outputs"
New-Item -ItemType Directory -Force -Path $out, $repoOut | Out-Null
$fixPrefix = Join-Path $harness "fix-prefix.mjs"
$runner = Join-Path $harness "run-case-any.ps1"
$mdb = "D:\Users\ZXQL\tools\mariadb\mariadb-11.4.5-winx64\bin\mariadb.exe"

function Invoke-Case {
  param([string]$RepoRoot, [string]$DbName, [string]$Tag, [switch]$NoReset)
  if ($NoReset) {
    & powershell -NoProfile -File $runner -RepoRoot $RepoRoot -DbName $DbName -Tag $Tag -OutDir $out -NoReset
  } else {
    & powershell -NoProfile -File $runner -RepoRoot $RepoRoot -DbName $DbName -Tag $Tag -OutDir $out
  }
}

function Set-Prefix {
  param([string]$Mode, [string]$RepoRoot)
  & node $fixPrefix $Mode $RepoRoot
  if ($LASTEXITCODE -ne 0) { throw "fix-prefix $Mode $RepoRoot 失败（EXIT=$LASTEXITCODE）" }
}

Write-Host "===== 1) 修复前（pre2）：基线工作树 + 24 条缺前缀 ====="
Set-Prefix "--unprefix" $base
Invoke-Case $base "s3190_pre2" "pre2"

Write-Host "===== 2) 基线（base2）：基线工作树 + 24 条已补前缀 ====="
Set-Prefix "--prefix" $base
Invoke-Case $base "s3190_base2" "base2"

Write-Host "===== 3) 修复后（post2）：本工作树（migration.ts 已修 + 24 条已补前缀） ====="
Set-Prefix "--prefix" $fixed
Invoke-Case $fixed "s3190_post2" "post2"

Write-Host "===== 4) 反测 F1 红：本工作树，把 24 条改回缺前缀 ====="
Set-Prefix "--unprefix" $fixed
Invoke-Case $fixed "s3190_f1red" "f1red"

Write-Host "===== 5) 反测 F1 绿：复原前缀 ====="
Set-Prefix "--prefix" $fixed
Invoke-Case $fixed "s3190_f1green" "f1green"

Write-Host "===== 6) 反测 F2（第 56 项）：'ADD 一并未执行' 的库级直证 ====="
# 在 base2 库上把目标键删掉后，**直接下发原语句**（不经产品代码），看它是否真的什么都没做：
#   ALTER TABLE t_sys_config DROP INDEX uk_config_key, ADD UNIQUE KEY uk_config_key_tenant (config_key, tenant_id);
# 预期（红）：报 ER_CANT_DROP_FIELD_OR_KEY，且 uk_config_key_tenant 仍然不存在 ⇒ 证明"DROP 失败时同语句的 ADD 一并回滚"。
$f2log = Join-Path $out "f2-add-rolled-back.txt"
"# 目标准备：删掉 uk_config_key_tenant（使其成为要 ADD 的目标）" | Set-Content -Path $f2log -Encoding utf8
# 注意：用 cmd 重定向收尾——PowerShell 5.1 在 $ErrorActionPreference='Stop' 下把"原生命令写 stderr（2>&1）"
# 当成终止性错误，会把整个驱动打断（本装置初版即因此停在半路）
cmd /c "`"$mdb`" --host=127.0.0.1 --port=3406 --user=root --skip-ssl -D s3190_base2 -e `"ALTER TABLE t_sys_config DROP INDEX uk_config_key_tenant;`" >> `"$f2log`" 2>&1"
$afterDrop = cmd /c "`"$mdb`" --host=127.0.0.1 --port=3406 --user=root --skip-ssl -N -B -e `"SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='s3190_base2' AND TABLE_NAME='t_sys_config' AND INDEX_NAME='uk_config_key_tenant';`""
("# 删后目标键计数（应为 0）：" + $afterDrop) | Add-Content -Path $f2log -Encoding utf8
"# 直发原语句（无守卫版）：" | Add-Content -Path $f2log -Encoding utf8
cmd /c "`"$mdb`" --host=127.0.0.1 --port=3406 --user=root --skip-ssl -D s3190_base2 -e `"ALTER TABLE t_sys_config DROP INDEX uk_config_key, ADD UNIQUE KEY uk_config_key_tenant (config_key, tenant_id);`" >> `"$f2log`" 2>&1"
$afterStmt = cmd /c "`"$mdb`" --host=127.0.0.1 --port=3406 --user=root --skip-ssl -N -B -e `"SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='s3190_base2' AND TABLE_NAME='t_sys_config' AND INDEX_NAME='uk_config_key_tenant';`""
("# 语句后目标键计数（若仍为 0 ⇒ ADD 一并未执行）：" + $afterStmt) | Add-Content -Path $f2log -Encoding utf8
Get-Content -LiteralPath $f2log | Write-Host

Write-Host "===== 7) 比对 + 摘要 ====="
$inOut = $out

foreach ($pair in @(@("base2", "pre2"), @("base2", "post2"), @("base2", "f1red"), @("base2", "f1green"))) {
  $b = Join-Path $inOut "$($pair[0])-snapshot.json"
  $t = Join-Path $inOut "$($pair[1])-snapshot.json"
  $detail = Join-Path $repoOut "diff-$($pair[0])-vs-$($pair[1]).txt"
  & node (Join-Path $harness "diff.mjs") $b $t $detail | Out-Null
  $head = (Get-Content -LiteralPath $detail -Encoding utf8 | Select-String '^差异合计' | Select-Object -First 1).Line
  Write-Host ("diff {0} vs {1} ⇒ EXIT={2}  {3}" -f $pair[0], $pair[1], $LASTEXITCODE, $head)
}
& node (Join-Path $harness "digest.mjs") (Join-Path $inOut "pre2-snapshot.json") (Join-Path $inOut "base2-snapshot.json") (Join-Path $inOut "post2-snapshot.json") (Join-Path $inOut "f1red-snapshot.json") (Join-Path $inOut "f1green-snapshot.json") |
  Tee-Object -FilePath (Join-Path $repoOut "structure-digest.txt")

# 只把小体积产物（counts / 指纹摘要 / diff 明细 / digest）留进仓库；快照与迁移日志（各 ~1.3MB / ~100KB）留在工作区外
foreach ($t in "pre2", "base2", "post2", "f1red", "f1green", "f2b", "f2red", "f2f", "f2green") {
  $c = Join-Path $out "$t-counts.txt"
  if (Test-Path $c) { Copy-Item $c (Join-Path $repoOut "$t-counts.txt") -Force }
}
Write-Host "小体积产物已落 $repoOut ；大体积（*-snapshot.json / *-migration.log）留在 $out"
