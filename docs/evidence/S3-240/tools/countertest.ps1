# S3-240 反测脚本（"该红就红" + 逐字节复原）
#
# 顺序（按派单规范 §9.1：先更新基线/先确认装置能红，再注入）：
#   ① 记录目标文件 SHA256（注入前）；
#   ② 备份到仓库外临时目录（Copy-Item，字节保真）；
#   ③ 注入违规 → 跑 `admin-web/tests/permission-gates.spec.mjs` → **必须 EXIT=1 且点名**；
#   ④ 复原（Copy-Item 回写）→ 复算 SHA256 **必须与注入前逐字节一致**；
#   ⑤ 再跑一次 → **必须 EXIT=0**（验绿）。
#
# 运行：pwsh -File docs/evidence/S3-240/tools/countertest.ps1 -Repo D:\Users\ZXQL\wt-agents\S3-240
param(
  [string]$Repo = "D:\Users\ZXQL\wt-agents\S3-240"
)
$ErrorActionPreference = "Stop"

$spec    = Join-Path $Repo "admin-web\tests\permission-gates.spec.mjs"
$brands  = Join-Path $Repo "admin-web\src\views\product\Brands.vue"
$appStore = Join-Path $Repo "admin-web\src\stores\app.ts"
$work    = Join-Path $Repo "admin-web"
$bakDir  = Join-Path ([System.IO.Path]::GetTempPath()) "s3240-countertest-bak"
New-Item -ItemType Directory -Force -Path $bakDir | Out-Null

$targets = @($brands, $appStore)
$before = @{}
foreach ($t in $targets) { $before[$t] = (Get-FileHash -LiteralPath $t -Algorithm SHA256).Hash }

Write-Output "=== ① 注入前 SHA256 ==="
foreach ($t in $targets) { Write-Output ("{0}  {1}" -f $before[$t], (Split-Path $t -Leaf)) }

Write-Output "=== ① 备份到仓库外临时目录 ==="
foreach ($t in $targets) { Copy-Item -LiteralPath $t -Destination (Join-Path $bakDir (Split-Path $t -Leaf)) -Force }
Write-Output "备份目录：$bakDir"

function Invoke-Spec {
  Push-Location $work
  $output = & node "tests/permission-gates.spec.mjs" 2>&1
  $code = $LASTEXITCODE
  Pop-Location
  return @{ Code = $code; Output = ($output -join "`n") }
}

function Restore-Targets {
  foreach ($t in $targets) { Copy-Item -LiteralPath (Join-Path $bakDir (Split-Path $t -Leaf)) -Destination $t -Force }
}

# ── 反测 1：摘掉 Brands.vue 上的按钮门（应被"注册表 ↔ 源码一致性"断言抓出）──
Write-Output "=== ② 反测 1：摘掉 Brands.vue 的 v-if=`"canGate('goods-brand-delete')`" ==="
$txt = Get-Content -LiteralPath $brands -Raw
$mut = $txt.Replace(" v-if=`"canGate('goods-brand-delete')`"", "")
if ($mut -eq $txt) { throw "反测 1 注入失败：未匹配到目标属性" }
Set-Content -LiteralPath $brands -Value $mut -NoNewline -Encoding utf8
$r1 = Invoke-Spec
Write-Output "EXIT=$($r1.Code)"
Write-Output ($r1.Output.Split("`n") | Select-Object -First 6)
if ($r1.Code -eq 0) { Restore-Targets; throw "反测 1 失败：摘掉按钮门后装置仍绿（假绿）" }
if ($r1.Output -notmatch "goods-brand-delete") { Restore-Targets; throw "反测 1 失败：红了但没点名 goods-brand-delete" }
Restore-Targets

# ── 反测 2：把判据换回 `includes()`（丢掉通配语义）⇒ 生产店主 `["*"]` 也应被打红 ──
Write-Output "=== ③ 反测 2：判据换回 includes()（丢掉 `*` / `dom:*` / `*:action` 通配）==="
$storeTxt = Get-Content -LiteralPath $appStore -Raw
$storeMut = $storeTxt.Replace(
  "  function hasPermissionCodesAll(codes: readonly string[]): boolean {`r`n    return hasPermissionCodes(permissions.value, codes);",
  "  function hasPermissionCodesAll(codes: readonly string[]): boolean {`r`n    return codes.every((c) => (permissions.value ?? []).includes(c));"
)
if ($storeMut -eq $storeTxt) { throw "反测 2 注入失败：未匹配到判据实现行" }
Set-Content -LiteralPath $appStore -Value $storeMut -NoNewline -Encoding utf8
$r2 = Invoke-Spec
Write-Output "EXIT=$($r2.Code)"
Write-Output ($r2.Output.Split("`n") | Select-Object -First 6)
if ($r2.Code -eq 0) { Restore-Targets; throw "反测 2 失败：丢掉通配语义后装置仍绿（假绿）" }
Restore-Targets

# ── 复原校验：逐字节 ──
Write-Output "=== ④ 复原后 SHA256（须与注入前逐字节一致）==="
$ok = $true
foreach ($t in $targets) {
  $after = (Get-FileHash -LiteralPath $t -Algorithm SHA256).Hash
  $same = ($after -eq $before[$t])
  if (-not $same) { $ok = $false }
  Write-Output ("{0}  {1}  identical={2}" -f $after, (Split-Path $t -Leaf), $same)
}
if (-not $ok) { throw "复原不一致：文件未逐字节回到注入前状态" }

Write-Output "=== ⑤ 复原后复跑装置（须 EXIT=0）==="
$r3 = Invoke-Spec
Write-Output ($r3.Output.Split("`n") | Select-Object -Last 4)
Write-Output "EXIT=$($r3.Code)"
if ($r3.Code -ne 0) { throw "复原后装置不绿" }
Write-Output "反测完成：两次注入均验红并点名，复原逐字节一致，复原后验绿"
