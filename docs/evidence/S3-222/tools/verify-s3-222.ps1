# S3-222 · 客户域权限接线（B2 批 4）· 证据一键复算脚本（只读，不写仓库代码）
#
# 用途：任何人（含凌舟）在本工作树里复跑本单的全部判据，逐条对应派单卡 §三。
# 前置：依赖已安装（本工作树 `node_modules` / `backend/node_modules` 为指向主检出的 junction，见回执 §七「环境复原」）。
#
# 用法：
#   pwsh -File docs/evidence/S3-222/tools/verify-s3-222.ps1
#
# 期望（本单交付时实测）：
#   ① 缺口 588 → 546（本域 45 = 42 已接 + 2 P 公开 + 1 W 待裁定）；已接线 136 → 178；consumerEnd 39 不变
#   ② --strict EXIT=0
#   ③ 本批用例 189 passed（含两侧判据、零回归逐角色复算、范围控制）
#   ④ 全量 vitest 672 文件 / 8499 用例 0 failed；tsc EXIT=0；build EXIT=0
$ErrorActionPreference = "Stop"
$wt = Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")
Write-Host "== 工作树：$wt =="

Write-Host "`n[0] 起点（防旧工作树污染）"
git -C $wt log --oneline -1
git -C $wt status --short --branch

Write-Host "`n[1] 门禁报告模式（期望：无授权形态 546 处 / 138 文件；已接线 178 处）"
node (Join-Path $wt "backend/scripts/guard-rbac-wiring.mjs") | Select-Object -First 2

Write-Host "`n[2] 门禁 --strict（期望 EXIT=0）"
node (Join-Path $wt "backend/scripts/guard-rbac-wiring.mjs") --strict | Select-Object -Last 3
Write-Host "--strict EXIT=$LASTEXITCODE"

Write-Host "`n[3] 本域残留缺口应为 3 条（2 条公开端点 + 1 条 confirm 待授权）"
node (Join-Path $wt "backend/scripts/guard-rbac-wiring.mjs") | Select-String -Pattern 'admin-customer|customer-care|customer-merge|customer-payment|customer-price|customer-segment|customer-statement|customer-tag|customer-type|customer-visit|member-register|tag\.routes'

Write-Host "`n[4] 权限码持有者复算（仓库种子口径；生产真值以凌舟只读核对为准）"
foreach ($code in @("customer:create", "customer:edit", "customer:visit", "customer:statement", "customer:payment")) {
  Write-Host "--- $code"
  node (Join-Path $wt "backend/scripts/guard-rbac-wiring.mjs") --holders $code | Select-Object -Skip 1 -First 1
}

Write-Host "`n[5] 本批验收用例（期望 189 passed）"
Push-Location (Join-Path $wt "backend")
npx vitest run src/__tests__/routes/rbac-b2-s3-222-customer-wiring.test.ts | Select-Object -Last 6
Pop-Location

Write-Host "`n[6] 类型检查（期望 0 行输出、EXIT=0）"
Push-Location (Join-Path $wt "backend")
npx tsc --noEmit
Write-Host "tsc EXIT=$LASTEXITCODE"
Pop-Location

Write-Host "`n[7] 反测 A/B/C（故意摘掉一条接线，证明门禁与用例会红）—— 见同目录 20*.txt / 21*.txt / 22*.txt / 23*.txt"
Write-Host "   摘掉 backend/src/routes/customer-visit.routes.ts 的 requirePermission(""customer:visit"") ⇒ 缺口 547 且 --strict EXIT=1（点出 customer-visit.routes.ts:20 POST /api/admin/customer-visits/）、"
Write-Host "   本批用例 3 failed / 186 passed；逐字节复原（SHA256 25CFF62A…A00ECCA）后 ⇒ 546 / EXIT=0 / 189 passed。"
