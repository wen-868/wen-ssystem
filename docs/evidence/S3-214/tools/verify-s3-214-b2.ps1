# S3-214-B2 · 采购域权限接线（阶段②）· 证据一键复算脚本（只读，不写仓库代码）
#
# 用途：任何人（含凌舟）在本工作树里复跑本单的全部判据，逐条对应派单卡 §四。
# 前置：依赖已安装（本工作树 node_modules 为指向主检出的 junction，见回执 §七「环境复原」）。
#
# 用法：
#   pwsh -File docs/evidence/S3-214/tools/verify-s3-214-b2.ps1
#
# 期望（本单交付时实测）：
#   ① 缺口 641 → 616（本域 31 = 25 已接 + 4 M 类 + 2 W 类）
#   ② --strict EXIT=0
#   ③ 本批用例 153 passed（含两侧判据与范围控制）
#   ④ 全量 vitest 0 failed；tsc 0；build EXIT=0
$ErrorActionPreference = "Stop"
$wt = Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")
Write-Host "== 工作树：$wt =="

Write-Host "`n[0] 起点（防旧工作树污染）"
git -C $wt log --oneline -1
git -C $wt status --short --branch

Write-Host "`n[1] 门禁报告模式（期望：无授权形态 616 处 / 151 文件；已接线 108 处）"
node (Join-Path $wt "backend/scripts/guard-rbac-wiring.mjs") | Select-Object -First 2

Write-Host "`n[2] 门禁 --strict（期望 EXIT=0）"
node (Join-Path $wt "backend/scripts/guard-rbac-wiring.mjs") --strict | Select-Object -Last 3
Write-Host "--strict EXIT=$LASTEXITCODE"

Write-Host "`n[3] 本域缺口应为 6 条（4 条移动端页签 + 2 条采购计划待授权）"
node (Join-Path $wt "backend/scripts/guard-rbac-wiring.mjs") | Select-String -Pattern 'purchase-|supplier'

Write-Host "`n[4] 权限码持有者复算（仓库种子口径；生产真值以凌舟只读核对为准）"
foreach ($code in @("purchase:create", "purchase:approve", "purchase:supplier", "inventory:inbound", "finance:payment", "sale:return", "report:finance", "supplier:statement")) {
  Write-Host "--- $code"
  node (Join-Path $wt "backend/scripts/guard-rbac-wiring.mjs") --holders $code | Select-Object -Skip 1 -First 1
}

Write-Host "`n[5] 本批验收用例（期望 153 passed）"
Push-Location (Join-Path $wt "backend")
npx vitest run src/__tests__/routes/rbac-b2-s3-214-purchase-wiring.test.ts | Select-Object -Last 6
Pop-Location

Write-Host "`n[6] 类型检查（期望 0 行输出）"
Push-Location (Join-Path $wt "backend")
npx tsc --noEmit
Write-Host "tsc EXIT=$LASTEXITCODE"
Pop-Location

Write-Host "`n[7] 反测 A/B（故意摘掉一条接线，证明门禁会红）—— 手动执行，见 docs/evidence/S3-214/20*.txt / 21*.txt"
Write-Host "   摘掉 backend/src/routes/purchase-in-stock.routes.ts 的 requirePermission(""inventory:inbound"") ⇒ 缺口 617 且 --strict EXIT=1；复原 ⇒ 616 / EXIT=0。"
