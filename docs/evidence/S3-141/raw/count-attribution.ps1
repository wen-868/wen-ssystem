# S3-141 归属计数校验（可复跑）：核对本卡 §3.2 的分组命中数是否与 rg 底稿一致
# 用法（仓库根）：powershell -File .mimosa/s3-141/count-attribution.ps1
$ErrorActionPreference = "Stop"
$src = ".mimosa/s3-141/rg-barcode-grouped.txt"

# 整文件归属（文件 -> 类别）
$wholeFile = @{
  "backend/src/controllers/admin/export.controller.ts"                        = "disp"
  "backend/src/controllers/admin/inventory-share.controller.ts"               = "disp"
  "backend/src/controllers/admin/library-copy.controller.ts"                  = "disp"
  "backend/src/controllers/admin/library.controller.ts"                       = "plat"
  "backend/src/controllers/admin/purchase.controller.ts"                      = "disp"
  "backend/src/controllers/miniapp/miniapp.controller.ts"                     = "disp"
  "backend/src/controllers/open/library.controller.ts"                        = "plat"
  "backend/src/controllers/platform/library.controller.ts"                    = "plat"
  "backend/src/routes/open-library.routes.ts"                                 = "plat"
  "backend/src/schemas/store-sale-bill.ts"                                    = "disp"
  "backend/src/services/admin/batch-price.service.ts"                         = "disp"
  "backend/src/services/admin/combo-product.service.ts"                       = "disp"
  "backend/src/services/admin/demo.service.ts"                                = "dep"
  "backend/src/services/admin/export.service.ts"                              = "disp"
  "backend/src/services/admin/inventory-loss-order.service.ts"                = "disp"
  "backend/src/services/admin/inventory-profit-order.service.ts"              = "disp"
  "backend/src/services/admin/inventory-share.service.ts"                     = "disp"
  "backend/src/services/admin/library-lookup.service.ts"                      = "plat"
  "backend/src/services/admin/price-review.service.ts"                        = "disp"
  "backend/src/services/admin/print-templates.ts"                             = "disp"
  "backend/src/services/admin/product-bundle.service.ts"                      = "disp"
  "backend/src/services/admin/purchase-order.service.ts"                      = "disp"
  "backend/src/services/admin/quote-push.service.ts"                          = "disp"
  "backend/src/services/admin/report.service.ts"                              = "disp"
  "backend/src/services/admin/report/product-report.service.ts"               = "disp"
  "backend/src/services/instant-retail/retail-ops-ext.service.ts"             = "disp"
  "backend/src/services/miniapp.service.ts"                                   = "disp"
  "backend/src/services/miniapp/wholesale.service.ts"                         = "disp"
  "backend/src/services/platform/library.service.ts"                          = "plat"
  "backend/src/services/purchase.service.ts"                                  = "disp"
  "backend/src/services/store/inventory.service.ts"                           = "disp"
  "backend/src/services/store/sale-bill.service.ts"                           = "disp"
  "backend/src/services/supplier.service.ts"                                  = "disp"
  "backend/src/services/sync/delta-sync.service.ts"                           = "disp"
}

# 逐行归属（混合文件）：行号 -> 类别
$byLine = @{
  "backend/src/controllers/admin/product.controller.ts" = @{ dep = @(59,78,246,248); disp = @(110,168,189) }
  "backend/src/controllers/store/product.controller.ts" = @{ dep = @(8) }
  "backend/src/routes/admin-product.routes.ts"          = @{ dep = @(39) }
  "backend/src/services/admin/data-transfer.service.ts" = @{ dep = @(423,424,430,431,440,443); disp = @(27,60,363,375,401) }
  "backend/src/services/admin/library-copy.service.ts"  = @{ dep = @(197,228,241,242,245,251,266,270); plat = @(301,305,306,307,379,413); disp = @(84,215,286,296) }
  "backend/src/services/admin/product.service.ts"       = @{ dep = @(387,423,426,690,694,697,700,707); disp = @(48,107,130,208,222,224,239,257,306,327,467,559,560,753,770,772,773,783,789,803,824,827,851,880,951,954) }
  "backend/src/services/store/product.service.ts"       = @{ dep = @(101); disp = @(21,33,74,95,104,114,115) }
  "backend/src/shared/migration.ts"                     = @{ ddl = @(855,870) }
  "backend/src/shared/seed-data.ts"                     = @{ dep = @(229,231); disp = @(210,211,212,213,214,215,216,217,218,219) }
}
# docs/ 两处 DDL 出处（不在 backend/src 底稿内，单列）
$docsDdl = 2

$counts = @{ dep = 0; plat = 0; disp = 0; ddl = 0 }
$fileHits = @{ dep = @(); plat = @(); disp = @(); ddl = @() }
$unassigned = @()
$assignedTotal = 0

foreach ($line in Get-Content $src) {
  $parts = $line -split '\|', 2
  $file = ($parts[0].Trim() -replace '\\', '/')
  $lines = $parts[1].Split(',') | ForEach-Object { [int]$_.Trim() }
  if ($wholeFile.ContainsKey($file)) {
    $counts[$wholeFile[$file]] += $lines.Count
    $fileHits[$wholeFile[$file]] += $file
    $assignedTotal += $lines.Count
    continue
  }
  if (-not $byLine.ContainsKey($file)) { $unassigned += "$file (整文件未分类)"; continue }
  $map = $byLine[$file]
  foreach ($ln in $lines) {
    $hit = $null
    foreach ($cat in $map.Keys) { if ($map[$cat] -contains $ln) { $hit = $cat; break } }
    if ($null -eq $hit) { $unassigned += "$file`:$ln"; continue }
    if ($fileHits[$hit] -notcontains $file) { $fileHits[$hit] += $file }
    $counts[$hit] += 1
    $assignedTotal += 1
  }
}

$total = ($counts.Values | Measure-Object -Sum).Sum
Write-Output ("backend/src 命中合计      : " + $assignedTotal)
Write-Output ("  依赖(dep)               : " + $counts.dep)
Write-Output ("  平台库(plat)            : " + $counts.plat)
Write-Output ("  展示/搜索/类型(disp)    : " + $counts.disp)
Write-Output ("  DDL(migration.ts)       : " + $counts.ddl)
Write-Output ("docs/ DDL 出处(单列)      : " + $docsDdl)
Write-Output ("未归属命中                : " + $unassigned.Count)
if ($unassigned.Count -gt 0) { $unassigned | ForEach-Object { Write-Output ("   - " + $_) } }

# 追加：各分类文件数
Write-Output ("依赖文件数: " + $fileHits.dep.Count + " | 平台库文件数: " + $fileHits.plat.Count + " | 展示类文件数: " + $fileHits.disp.Count + " | DDL文件数: " + $fileHits.ddl.Count)
