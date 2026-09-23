# C2-4 核验①（结论 1）：`待接入` 计数前后对比 —— 独立复跑（用 git 读历史提交内容，不依赖凌舟的脚本/结论）
#
# 口径说明（两种都给出，避免口径歧义）：
#   口径 A（派单卡自己写的复跑命令）：`rg -c 'TODO|FIXME|待接入'` ⇒ **匹配行数**，范围 saas-admin
#   口径 B：字面量 `待接入` 的**出现次数**
#
# 用法：pwsh -File docs/evidence/C2-4/tools/c2-4-04-pending-count.ps1
$ErrorActionPreference = "Continue"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
Set-Location $repo

$outFile = Join-Path $repo "docs/evidence/C2-4/outputs/04-pending-count.txt"
$lines = New-Object System.Collections.Generic.List[string]
function W($s = "") { $lines.Add($s); Write-Output $s }

function Count-Lines([string]$rev, [string[]]$scope, [string]$pattern) {
  $raw = & git grep -c -E $pattern $rev -- @scope 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $raw) { return 0 }
  return ($raw | ForEach-Object { [int](($_ -split ":")[-1]) } | Measure-Object -Sum).Sum
}
function Count-Occurrences([string]$rev, [string[]]$scope, [string]$pattern) {
  $raw = & git grep -o -E $pattern $rev -- @scope 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $raw) { return 0 }
  return ($raw | Measure-Object).Count
}

W "[C2-4/04] 待接入计数独立复跑（git 读历史提交内容）"
W "          仓库根：$repo"
W "          当前 HEAD：$(& git rev-parse --short HEAD)"
W ""
W "口径 A = 匹配行数（pattern: TODO|FIXME|待接入）"
W "口径 B = 字面量出现次数（pattern: 待接入）"
W ""

$revs = @(
  @{ name = "C2-F 之前 4217ee30e^"; rev = "4217ee30e^" },
  @{ name = "C2-F 提交 4217ee30e";  rev = "4217ee30e" },
  @{ name = "当前 HEAD";             rev = "HEAD" }
)
$scopes = @(
  @{ name = "saas-admin（全端）"; scope = @("saas-admin") },
  @{ name = "Announcements.vue";  scope = @("saas-admin/src/views/Announcements.vue") },
  @{ name = "TemplateCenter.vue"; scope = @("saas-admin/src/views/platform/TemplateCenter.vue") },
  @{ name = "两个目标文件合计";   scope = @("saas-admin/src/views/Announcements.vue", "saas-admin/src/views/platform/TemplateCenter.vue") }
)

foreach ($rev in $revs) {
  W "== $($rev.name)（git rev-parse $($rev.rev) = $(& git rev-parse --short $rev.rev)） =="
  foreach ($sc in $scopes) {
    $a = Count-Lines $rev.rev $sc.scope "TODO|FIXME|待接入"
    $b = Count-Occurrences $rev.rev $sc.scope "待接入"
    W ("  {0,-22} 口径A(行)={1,-5} 口径B(次)={2}" -f $sc.name, $a, $b)
  }
  W ""
}

W "== 差集（C2-F 之前 ⇒ 当前） =="
foreach ($sc in $scopes) {
  $before = Count-Lines "4217ee30e^" $sc.scope "TODO|FIXME|待接入"
  $after = Count-Lines "HEAD" $sc.scope "TODO|FIXME|待接入"
  W ("  {0,-22} 口径A：{1} → {2}（Δ{3}）" -f $sc.name, $before, $after, ($before - $after))
}
W ""
W "== 当前 HEAD 上仍含 pattern(TODO|FIXME|待接入) 的文件（行数） =="
$remaining = & git grep -c -E "TODO|FIXME|待接入" HEAD -- saas-admin 2>$null
foreach ($r in ($remaining | Sort-Object)) { W "  $r" }
$sum = (($remaining | ForEach-Object { [int](($_ -split ":")[-1]) } | Measure-Object -Sum).Sum)
W "  合计行数 = $sum"
W ""
W "== 复跑命令（可逐条重放） =="
W "  git grep -c -E 'TODO|FIXME|待接入' 4217ee30e^ -- saas-admin"
W "  git grep -c -E 'TODO|FIXME|待接入' HEAD -- saas-admin"
W "  git grep -c -E 'TODO|FIXME|待接入' HEAD -- saas-admin/src/views/Announcements.vue saas-admin/src/views/platform/TemplateCenter.vue"
W "  git grep -o -E '待接入' HEAD -- saas-admin | Measure-Object"

[IO.File]::WriteAllText($outFile, ($lines -join "`r`n") + "`r`n", (New-Object Text.UTF8Encoding($false)))
Write-Output ""
Write-Output "已落盘：$outFile"
