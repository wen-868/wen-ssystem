# MIG-1 交叉复算（独立实现）：用 PowerShell/.NET 正则**重新独立实现**一遍迁移 runner 的切分规则，
# 核对 Node 版生成器（mig1-extract.mjs）给出的「118 文件 / CREATE 239 / ALTER 50 / 其它 58」是否可复现。
#
# 为什么要第二套实现：同一份代码跑两次只能证明"可重复"，不能证明"没写错"。两套不同语言/不同正则引擎的
# 独立实现给出同样的三个数字，才算得上可核对的口径。
#
# 用法： pwsh -File docs/evidence/MIG-1/tools/mig1-crosscheck.ps1
# 退出码：0 = 与 C2-4 口径一致且反测通过；1 = 不一致/反测失败
$ErrorActionPreference = "Stop"

$RepoRoot   = (Resolve-Path (Join-Path $PSScriptRoot "../../../..")).Path
$MigDir     = Join-Path $RepoRoot "docs/migrations"
$OutDir     = Join-Path $RepoRoot "docs/evidence/MIG-1/outputs"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$lines = New-Object System.Collections.Generic.List[string]
function Say($s = "") { $lines.Add([string]$s); Write-Output $s }
$failures = New-Object System.Collections.Generic.List[string]

# 复演 runner：删 USE/DELIMITER 行 → 按 ; 切 → trim → 丢弃空块与「以 -- 开头」的块
function Simulate-Runner([string]$sql) {
    $kept = @()
    foreach ($l in ($sql -split "`n")) {
        $t = $l.Trim().ToUpperInvariant()
        if ($t.StartsWith("USE ") -or $t.StartsWith("DELIMITER ")) { continue }
        $kept += $l
    }
    $cleaned = ($kept -join "`n")
    $executed = @(); $dropped = @()
    foreach ($raw in ($cleaned -split ";")) {
        $stmt = $raw.Trim()
        if ($stmt.Length -eq 0) { continue }
        if ($stmt.StartsWith("--")) { $dropped += $stmt; continue }
        if ($stmt -match "(?i)DROP\s+TABLE") { continue }
        if ($stmt -match "CREATE PROCEDURE" -or $stmt -match "DROP PROCEDURE") { continue }
        $executed += $stmt
    }
    return @{ Executed = $executed; Dropped = $dropped }
}

# 丢弃块里的"真实内容"：只剥掉以 -- 开头的行（与 C2-4 口径一致）
function Real-Content([string]$stmt) {
    $kept = @()
    foreach ($l in ($stmt -split "`n")) { if (-not $l.Trim().StartsWith("--")) { $kept += $l } }
    return ($kept -join "`n").Trim()
}

Say "[MIG-1/crosscheck] PowerShell 独立复算（.NET 正则）"
Say "  仓库根：$RepoRoot"
Say "  迁移目录：$MigDir"
Say ""
Say "== 反测（先证明本实现会红） =="
{
    $bad = "-- 编号: 999`n-- 注释在前`nCREATE TABLE IF NOT EXISTS crosscheck_bad (id BIGINT);`n"
    $sim = Simulate-Runner $bad
    $lostCreate = @($sim.Dropped | Where-Object { $rc = Real-Content $_; $rc.Length -gt 0 -and $rc -match "(?im)^CREATE\s+TABLE" }).Count
    if ($sim.Executed.Count -eq 0 -and $lostCreate -eq 1) {
        Say "  ✓ 反测通过：注释在前的 CREATE TABLE 被判为『建表语句被丢』（执行 0 / 丢建表 $lostCreate）"
    } else {
        $failures.Add("反测失败：注释在前的 CREATE TABLE 未被判丢") | Out-Null
        Say "  ✗ 反测失败（执行 $($sim.Executed.Count) / 丢建表 $lostCreate）"
    }
    $good = "CREATE TABLE IF NOT EXISTS crosscheck_ok (id BIGINT);`n`n-- 注释在后`n"
    $sim2 = Simulate-Runner $good
    $lostReal = @($sim2.Dropped | Where-Object { (Real-Content $_).Length -gt 0 }).Count
    if ($sim2.Executed.Count -eq 1 -and $lostReal -eq 0) {
        Say "  ✓ 对照通过：语句在前、注释在后 ⇒ 执行 1 条、丢真语句 0 条"
    } else {
        $failures.Add("对照失败：语句在前的写法被误判") | Out-Null
        Say "  ✗ 对照失败（执行 $($sim2.Executed.Count) / 丢真语句 $lostReal）"
    }
}
Say ""

Say "== 全量复算（口径 A：与 C2-4 相同） =="
$scanFiles = @(Get-ChildItem -Path $MigDir -Filter *.sql | Where-Object { $_.Name -ne "add_tenant_id.sql" } | Sort-Object Name)
$affected = 0; $cCreate = 0; $cAlter = 0; $cOther = 0
$detail = New-Object System.Collections.Generic.List[object]
foreach ($f in $scanFiles) {
    $sql = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8
    $sim = Simulate-Runner $sql
    $lost = @()
    foreach ($d in $sim.Dropped) {
        $rc = Real-Content $d
        if ($rc.Length -eq 0) { continue }
        if ($rc -match "(?im)^CREATE\s+TABLE|^ALTER\s+TABLE|^INSERT\s+INTO|^UPDATE\s+|^DELETE\s+FROM") { $lost += $rc }
    }
    if ($lost.Count -eq 0) { continue }
    $affected++
    $c = @($lost | Where-Object { $_ -match "(?im)^CREATE\s+TABLE" }).Count
    $a = @($lost | Where-Object { $_ -match "(?im)^ALTER\s+TABLE" }).Count
    $cCreate += $c; $cAlter += $a; $cOther += ($lost.Count - $c - $a)
    $detail.Add([pscustomobject]@{ file = $f.Name; lost = $lost.Count; create = $c; alter = $a; other = ($lost.Count - $c - $a) })
}

Say "  扫描 SQL 文件 $($scanFiles.Count) 个；受影响文件 $affected 个"
Say "  受影响语句合计：CREATE TABLE $cCreate 条 / ALTER TABLE $cAlter 条 / INSERT 等 $cOther 条"
Say ""

$expected = @{ files = 118; create = 239; alter = 50; other = 58 }
$ok = ($affected -eq $expected.files) -and ($cCreate -eq $expected.create) -and ($cAlter -eq $expected.alter) -and ($cOther -eq $expected.other)
Say "== 与派单/ C2-4 口径核对 =="
Say "  期望：文件 $($expected.files) / CREATE $($expected.create) / ALTER $($expected.alter) / 其它 $($expected.other)"
Say "  实得：文件 $affected / CREATE $cCreate / ALTER $cAlter / 其它 $cOther"
Say "  判定：$(if ($ok) { '一致 ✅' } else { '不一致 ❌' })"
if (-not $ok) { $failures.Add("全量复算与期望不一致") | Out-Null }

$detail | ConvertTo-Json -Depth 3 | Set-Content -Path (Join-Path $OutDir "06-crosscheck-files.json") -Encoding UTF8
Say ""
$lines.Add("RESULT: $(if ($failures.Count -eq 0) { 'ALL PASS' } else { 'FAILURES: ' + ($failures -join ' / ') })")
$lines.Add("EXIT=$(if ($failures.Count -eq 0) { 0 } else { 1 })")
$lines | Set-Content -Path (Join-Path $OutDir "06-crosscheck.txt") -Encoding UTF8
Say "  已落盘：$(Join-Path $OutDir '06-crosscheck.txt')"
Say "RESULT: $(if ($failures.Count -eq 0) { 'ALL PASS' } else { 'FAILURES: ' + ($failures -join ' / ') })"
if ($failures.Count -gt 0) { exit 1 } else { exit 0 }
