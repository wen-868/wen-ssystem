# 台账 40 · admin-web 页面质量台账（mock / 占位 / 恒空 / 缺失接口 / 未验运行态）

> 由 `docs/evidence/WB-REFACTOR-P0/scripts/parse-page-quality.cjs` 生成，页面全集基准复用矩阵10 权威清单 `table-a-routes.csv`（`parse-routes.cjs` 产出，路由行 164）。所有数字由脚本产出，人工不得手改。
> 复跑：`node docs/evidence/WB-REFACTOR-P0/scripts/parse-routes.cjs --out <dir>` 后 
> `node docs/evidence/WB-REFACTOR-P0/scripts/parse-page-quality.cjs --routes-csv <dir>/table-a-routes.csv --out docs/evidence/WB-REFACTOR-P0/40-page-quality-ledger.md`

## 摘要

| 指标 | 数值 |
| --- | ---: |
| 总页数（admin-web/src/views/**/*.vue 文件数） | 157 |
| P0 冒充 LIVE | 1 |
| P1 部分假 | 48 |
| P2 纯占位 | 3 |
| P3 干净 | 97 |
| UNKNOWN（脚本无法判定，待人工） | 8 |
| 零 mock 命中页数 | 154 |
| 无任何接口引用页数（无 import api / 无 HTTP 调用） | 9 |
| 有可解析接口调用页数 | 148 |
| api import 目标盘上不可解析页数（缺失接口/模块链未验线索） | 0 |
| catch 内 []/{} 空兜底页数（恒空候选，NEEDS_EYE） | 38 |
| import 符号在 api 层无导出的页数（缺失接口候选） | 0 |
| 有 catch 但全篇无错误提示页数（静默失败候选，NEEDS_EYE） | 12 |
| 未被任何路由挂载的 views 文件数 | 2 |

### 命中总量（逐类）

| 类别 | mock | random | fakeCn | placeholder | catchEmpty | errorReset | missingExport | apiResolved | apiMissing | directHttp | otherMissingMod |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 命中数 | 9 | 5 | 0 | 3 | 49 | 27 | 0 | 164 | 0 | 12 | 0 |

### 判定规则（脚本确定式，禁止人工凭印象改判）

- **P0 冒充 LIVE**：假数据信号（mock + Math.random + 模拟/演示/示例文案）>0 且**全篇无任何接口引用**——数据全靠造，却呈现为正常业务页。
- **P1 部分假**：假数据信号>0 且存在接口引用（真假并存）；或有接口引用但存在 catch 空兜底 / 静默失败（恒空候选）。
- **P2 纯占位**：无假数据信号、无接口引用，仅占位文案（功能开发中 / 敬请期待 / 待实现 / TODO / FIXME）。
- **P3 干净**：以上全无，且有**盘上可解析**的真实接口调用。
- **UNKNOWN**：静态模式判不动（接口引用全部不可解析 / 纯静态页 / 非路由子组件），一律待人工。
- 注释行（`//`、块注释、模板注释）里的关键词命中不计入 mock/占位计数，改为逐行登记在「注释线索」节；带 `[DEV_NOTE]` 的是「后端未实现 / 无数据源 / 空态 / mock」散文自证。
- catch 窗口里**已有**错误提示的 `[]`/`{}` 归为 `errorReset`（正常失败清空），不算恒空、不驱动严重度；只有无提示的静默空兜底才计 `catchEmpty`。
- 反测（夹具在仓库外，未动业务代码）：注入 mock 声明 + Math.random + 占位文案 + 静默 catch 空兜底 + api 层未导出符号 ⇒ 脚本如实报 MOCK=1 RANDOM=1 PLACEHOLDER=1 CATCH_EMPTY=1 MISSING_EXPORT=1、严重度 P1（见脚本头注释）。

## 逐页台账

| # | 页面（组件文件） | 路由 path | mock 数 | Math.random | 模拟/演示/示例文案 | 占位文案数 | 恒空兜底数 | 缺失接口符号数 | 无真实 API 调用? | 缺失接口/恒空线索 | 严重度 | 证据 ref |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| 1 | admin-web/src/views/components/PlatformPanel.vue | 无路由(未挂载) | 0 | 3 | 0 | 0 | 0 | 0 | 是（无任何接口引用） | catch x1 但全篇无错误提示（静默失败候选 NEEDS_EYE）；无任何接口 import / HTTP 调用 | P0 冒充 LIVE | random:admin-web/src/views/components/PlatformPanel.vue:239 admin-web/src/views/components/PlatformPanel.vue:266 admin-web/src/views/components/PlatformPanel.vue:282 |
| 2 | admin-web/src/views/customer/CustomerProfile.vue | /customer-profile | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/customer/CustomerProfile.vue:142 ‖ api:admin-web/src/views/customer/CustomerProfile.vue:119 [../../api] |
| 3 | admin-web/src/views/customer/CustomerSegments.vue | /customer-segments | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/customer/CustomerSegments.vue:188 ‖ api:admin-web/src/views/customer/CustomerSegments.vue:123 [../../api] |
| 4 | admin-web/src/views/customer/CustomerTags.vue | /customer-tags | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/customer/CustomerTags.vue:227 ‖ api:admin-web/src/views/customer/CustomerTags.vue:123 [../../api] |
| 5 | admin-web/src/views/dashboard/Dashboard.vue | /dashboard | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | catch x1 但全篇无错误提示（静默失败候选 NEEDS_EYE） | P1 部分假 | api:admin-web/src/views/dashboard/Dashboard.vue:203 [../../api/report] admin-web/src/views/dashboard/Dashboard.vue:204 [../../api] admin-web/src/views/dashboard/Dashboard.vue:205 [../../api/finance] |
| 6 | admin-web/src/views/finance/FinanceCollection.vue | /finance/collection | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/finance/FinanceCollection.vue:178 ‖ api:admin-web/src/views/finance/FinanceCollection.vue:128 [../../api] |
| 7 | admin-web/src/views/finance/FinanceDashboard.vue | /finance/dashboard | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | catch x1 但全篇无错误提示（静默失败候选 NEEDS_EYE） | P1 部分假 | api:admin-web/src/views/finance/FinanceDashboard.vue:124 [../../api] |
| 8 | admin-web/src/views/finance/FinanceProfit.vue | /finance/profit | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | catch x1 但全篇无错误提示（静默失败候选 NEEDS_EYE） | P1 部分假 | api:admin-web/src/views/finance/FinanceProfit.vue:112 [../../api] |
| 9 | admin-web/src/views/finance/PaymentsNewView.vue | /finance/payments | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/finance/PaymentsNewView.vue:339 ‖ api:admin-web/src/views/finance/PaymentsNewView.vue:209 [../../api] |
| 10 | admin-web/src/views/finance/ReceiptsView.vue | /finance/receipts | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/finance/ReceiptsView.vue:349 ‖ api:admin-web/src/views/finance/ReceiptsView.vue:219 [../../api] |
| 11 | admin-web/src/views/finance/ReceivablesPayables.vue | /finance/receivables-payables | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | catch x1 但全篇无错误提示（静默失败候选 NEEDS_EYE） | P1 部分假 | api:admin-web/src/views/finance/ReceivablesPayables.vue:175 [../../api] |
| 12 | admin-web/src/views/instant-retail/InstantRetailDashboard.vue | /instant-retail/dashboard | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/instant-retail/InstantRetailDashboard.vue:348 ‖ api:admin-web/src/views/instant-retail/InstantRetailDashboard.vue:209 [../../api] |
| 13 | admin-web/src/views/instant-retail/InstantRetailShelf.vue | /instant-retail/shelf | 3 | 0 | 0 | 0 | 2 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x2（恒空候选 NEEDS_EYE）；mock 死声明 x3（只声明未引用＝未接线假数据/恒空）：admin-web/src/views/instant-retail/InstantRetailShelf.vue:393 (mockCategories 仅声明未引用) admin-web/src/views/instant-retail/InstantRetailShelf.vue:395 (mockProducts 仅声明未引用) | P1 部分假 | mock:admin-web/src/views/instant-retail/InstantRetailShelf.vue:393 admin-web/src/views/instant-retail/InstantRetailShelf.vue:395 admin-web/src/views/instant-retail/InstantRetailShelf.vue:515 ‖ catchEmpty:admin-web/src/views/instant-retail/InstantRetailShelf.vue:402 admin-web/src/views/instant-retail/InstantRetailShelf.vue:527 ‖ api:admin-web/src/views/instant-retail/InstantRetailShelf.vue:362 [../../api] |
| 14 | admin-web/src/views/inventory/InventoryCheck.vue | /inventory-check | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/inventory/InventoryCheck.vue:344 ‖ api:admin-web/src/views/inventory/InventoryCheck.vue:266 [../../api] |
| 15 | admin-web/src/views/inventory/InventoryPriceQuote.vue | /inventory-price-quote | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/inventory/InventoryPriceQuote.vue:316 ‖ api:admin-web/src/views/inventory/InventoryPriceQuote.vue:177 [../../api] |
| 16 | admin-web/src/views/inventory/InventoryShareConfig.vue | /inventory-share-config | 0 | 0 | 0 | 0 | 2 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x2（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/inventory/InventoryShareConfig.vue:368 admin-web/src/views/inventory/InventoryShareConfig.vue:487 ‖ api:admin-web/src/views/inventory/InventoryShareConfig.vue:304 [../../api] |
| 17 | admin-web/src/views/inventory/InventoryTransfer.vue | /inventory-transfer | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/inventory/InventoryTransfer.vue:737 ‖ api:admin-web/src/views/inventory/InventoryTransfer.vue:414 [../../api] |
| 18 | admin-web/src/views/marketing/FullReduction.vue | /marketing/full-reduction | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/marketing/FullReduction.vue:251 ‖ api:admin-web/src/views/marketing/FullReduction.vue:195 [../../api] |
| 19 | admin-web/src/views/marketing/MarketingDashboard.vue | /marketing/dashboard | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | catch x7 但全篇无错误提示（静默失败候选 NEEDS_EYE） | P1 部分假 | api:admin-web/src/views/marketing/MarketingDashboard.vue:222 [@/api] |
| 20 | admin-web/src/views/marketing/MarketingGiftRule.vue | /marketing/gift-rule | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE）；注释自证线索 x1（后端未实现/无数据源/空态/mock 等**散文证据**，不计入命中数，详见「注释线索」节 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/marketing/MarketingGiftRule.vue:462 ‖ api:admin-web/src/views/marketing/MarketingGiftRule.vue:215 [../../api] |
| 21 | admin-web/src/views/marketing/MarketingLimitedDiscount.vue | /marketing/limited-discount | 0 | 0 | 0 | 0 | 2 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x2（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/marketing/MarketingLimitedDiscount.vue:430 admin-web/src/views/marketing/MarketingLimitedDiscount.vue:455 ‖ api:admin-web/src/views/marketing/MarketingLimitedDiscount.vue:263 [../../api] |
| 22 | admin-web/src/views/marketing/MarketingPointsMall.vue | /marketing/points-mall | 2 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | mock 死声明 x2（只声明未引用＝未接线假数据/恒空）：admin-web/src/views/marketing/MarketingPointsMall.vue:286 (mockProducts 仅声明未引用) admin-web/src/views/marketing/MarketingPointsMall.vue:288 (mockExchangeRecords 仅声明未引用)；注释自证线索 x1（后端未实现/无数据源/空态/mock 等**散文证据**，不计入命中数，详见「注释线索」节 NEEDS_EYE） | P1 部分假 | mock:admin-web/src/views/marketing/MarketingPointsMall.vue:286 admin-web/src/views/marketing/MarketingPointsMall.vue:288 ‖ api:admin-web/src/views/marketing/MarketingPointsMall.vue:280 [../../api] |
| 23 | admin-web/src/views/marketing/MarketingTags.vue | /marketing/tags | 0 | 0 | 0 | 0 | 2 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x2（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/marketing/MarketingTags.vue:389 admin-web/src/views/marketing/MarketingTags.vue:402 ‖ api:admin-web/src/views/marketing/MarketingTags.vue:226 [../../api] |
| 24 | admin-web/src/views/marketing/MarketingView.vue | /marketing | 0 | 0 | 0 | 0 | 2 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x2（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/marketing/MarketingView.vue:341 admin-web/src/views/marketing/MarketingView.vue:569 ‖ api:admin-web/src/views/marketing/MarketingView.vue:249 [../../api] |
| 25 | admin-web/src/views/order/OrderAftersaleView.vue | /order-aftersale | 0 | 0 | 0 | 0 | 2 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x2（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/order/OrderAftersaleView.vue:340 admin-web/src/views/order/OrderAftersaleView.vue:419 ‖ api:admin-web/src/views/order/OrderAftersaleView.vue:230 [@/api] |
| 26 | admin-web/src/views/order/OrderExceptionView.vue | /order-exception | 0 | 1 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE）；注释自证线索 x1（后端未实现/无数据源/空态/mock 等**散文证据**，不计入命中数，详见「注释线索」节 NEEDS_EYE） | P1 部分假 | random:admin-web/src/views/order/OrderExceptionView.vue:217 ‖ catchEmpty:admin-web/src/views/order/OrderExceptionView.vue:514 ‖ api:admin-web/src/views/order/OrderExceptionView.vue:254 [../../api] |
| 27 | admin-web/src/views/order/OrderProductMapView.vue | /order-product-map | 0 | 1 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 注释自证线索 x1（后端未实现/无数据源/空态/mock 等**散文证据**，不计入命中数，详见「注释线索」节 NEEDS_EYE） | P1 部分假 | random:admin-web/src/views/order/OrderProductMapView.vue:380 ‖ api:admin-web/src/views/order/OrderProductMapView.vue:278 [../../api/instant-retail] |
| 28 | admin-web/src/views/order/OrderRoutingView.vue | /order-routing | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE）；注释自证线索 x1（后端未实现/无数据源/空态/mock 等**散文证据**，不计入命中数，详见「注释线索」节 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/order/OrderRoutingView.vue:478 ‖ api:admin-web/src/views/order/OrderRoutingView.vue:267 [../../api] admin-web/src/views/order/OrderRoutingView.vue:268 [../../api/system] |
| 29 | admin-web/src/views/pos/CashierView.vue | /pos/cashier | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/pos/CashierView.vue:1188 ‖ api:admin-web/src/views/pos/CashierView.vue:641 [../../api] admin-web/src/views/pos/CashierView.vue:658 [../../api/hardware] |
| 30 | admin-web/src/views/pos/StoreControlView.vue | /pos/store-control | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | catch x2 但全篇无错误提示（静默失败候选 NEEDS_EYE） | P1 部分假 | api:admin-web/src/views/pos/StoreControlView.vue:60 [../../api] |
| 31 | admin-web/src/views/product/ProductCombo.vue | /products/combo | 0 | 0 | 0 | 0 | 2 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x2（恒空候选 NEEDS_EYE）；注释自证线索 x2（后端未实现/无数据源/空态/mock 等**散文证据**，不计入命中数，详见「注释线索」节 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/product/ProductCombo.vue:662 admin-web/src/views/product/ProductCombo.vue:669 ‖ api:admin-web/src/views/product/ProductCombo.vue:631 [../../api] admin-web/src/views/product/ProductCombo.vue:645 [../../api] |
| 32 | admin-web/src/views/product/ProductReviewTasks.vue | /products/review-tasks | 4 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | mock 死声明 x4（只声明未引用＝未接线假数据/恒空）：admin-web/src/views/product/ProductReviewTasks.vue:269 (mockPendingList 仅声明未引用) admin-web/src/views/product/ProductReviewTasks.vue:271 (mockReviewedList 仅声明未引用)；注释自证线索 x1（后端未实现/无数据源/空态/mock 等**散文证据**，不计入命中数，详见「注释线索」节 NEEDS_EYE） | P1 部分假 | mock:admin-web/src/views/product/ProductReviewTasks.vue:269 admin-web/src/views/product/ProductReviewTasks.vue:271 admin-web/src/views/product/ProductReviewTasks.vue:273 ‖ api:admin-web/src/views/product/ProductReviewTasks.vue:264 [../../api/product] |
| 33 | admin-web/src/views/product/Products.vue | /products | 0 | 0 | 0 | 0 | 2 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x2（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/product/Products.vue:946 admin-web/src/views/product/Products.vue:1105 ‖ api:admin-web/src/views/product/Products.vue:643 [../../api] admin-web/src/views/product/Products.vue:644 [../../api/library] |
| 34 | admin-web/src/views/product/ProductTagRelation.vue | /products/tag-relation | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/product/ProductTagRelation.vue:105 ‖ api:admin-web/src/views/product/ProductTagRelation.vue:70 [../../api] |
| 35 | admin-web/src/views/purchase/PurchasePayments.vue | /purchase-payments | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/purchase/PurchasePayments.vue:332 ‖ api:admin-web/src/views/purchase/PurchasePayments.vue:254 [../../api] |
| 36 | admin-web/src/views/report/CollectionAnalysis.vue | /reports/collection-analysis | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE）；注释自证线索 x1（后端未实现/无数据源/空态/mock 等**散文证据**，不计入命中数，详见「注释线索」节 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/report/CollectionAnalysis.vue:215 ‖ api:admin-web/src/views/report/CollectionAnalysis.vue:192 [@/api] admin-web/src/views/report/CollectionAnalysis.vue:193 [@/api/common] |
| 37 | admin-web/src/views/report/CustomerAnalysis.vue | /reports/customers | 0 | 0 | 0 | 0 | 2 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x2（恒空候选 NEEDS_EYE）；catch x3 但全篇无错误提示（静默失败候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/report/CustomerAnalysis.vue:219 admin-web/src/views/report/CustomerAnalysis.vue:303 ‖ api:admin-web/src/views/report/CustomerAnalysis.vue:175 [@/api] |
| 38 | admin-web/src/views/report/CustomReport.vue | /reports/custom-report | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/report/CustomReport.vue:742 ‖ api:admin-web/src/views/report/CustomReport.vue:424 [@/api] |
| 39 | admin-web/src/views/report/ReportsEmployees.vue | /reports/employees | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE）；catch x1 但全篇无错误提示（静默失败候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/report/ReportsEmployees.vue:88 ‖ api:admin-web/src/views/report/ReportsEmployees.vue:67 [../../api] |
| 40 | admin-web/src/views/report/ReportsProducts.vue | /reports/products | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE）；catch x1 但全篇无错误提示（静默失败候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/report/ReportsProducts.vue:110 ‖ api:admin-web/src/views/report/ReportsProducts.vue:80 [../../api] |
| 41 | admin-web/src/views/report/ReportsStores.vue | /reports/stores | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE）；catch x1 但全篇无错误提示（静默失败候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/report/ReportsStores.vue:100 ‖ api:admin-web/src/views/report/ReportsStores.vue:78 [../../api] |
| 42 | admin-web/src/views/report/SalesAnalysis.vue | /reports/sales-analysis | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/report/SalesAnalysis.vue:283 ‖ api:admin-web/src/views/report/SalesAnalysis.vue:235 [@/api] admin-web/src/views/report/SalesAnalysis.vue:236 [@/api/common] |
| 43 | admin-web/src/views/sale/CommissionRecords.vue | /sales/commission/records | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/sale/CommissionRecords.vue:198 ‖ api:admin-web/src/views/sale/CommissionRecords.vue:103 [../../api] |
| 44 | admin-web/src/views/sale/SalesReports.vue | /sales/reports | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | catch x5 但全篇无错误提示（静默失败候选 NEEDS_EYE） | P1 部分假 | api:admin-web/src/views/sale/SalesReports.vue:80 [../../api] |
| 45 | admin-web/src/views/system/ApprovalRules.vue | /system/approval/rules | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/system/ApprovalRules.vue:194 ‖ api:admin-web/src/views/system/ApprovalRules.vue:110 [../../api] |
| 46 | admin-web/src/views/system/MiniappConfigView.vue | /system/miniapp | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/system/MiniappConfigView.vue:713 ‖ api:admin-web/src/views/system/MiniappConfigView.vue:300 [../../api] |
| 47 | admin-web/src/views/system/MonitorView.vue | /monitor | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/system/MonitorView.vue:230 ‖ api:admin-web/src/views/system/MonitorView.vue:131 [../../api] |
| 48 | admin-web/src/views/system/PaymentConfigView.vue | /system/payment | 0 | 0 | 0 | 0 | 1 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x1（恒空候选 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/system/PaymentConfigView.vue:468 ‖ api:admin-web/src/views/system/PaymentConfigView.vue:262 [../../api] |
| 49 | admin-web/src/views/system/SystemConfigView.vue | /system/config | 0 | 0 | 0 | 0 | 3 | 0 | 否（有可解析接口调用） | catch 内 []/{} 兜底 x3（恒空候选 NEEDS_EYE）；注释自证线索 x1（后端未实现/无数据源/空态/mock 等**散文证据**，不计入命中数，详见「注释线索」节 NEEDS_EYE） | P1 部分假 | catchEmpty:admin-web/src/views/system/SystemConfigView.vue:480 admin-web/src/views/system/SystemConfigView.vue:533 admin-web/src/views/system/SystemConfigView.vue:571 ‖ api:admin-web/src/views/system/SystemConfigView.vue:302 [../../api] admin-web/src/views/system/SystemConfigView.vue:303 [../../api/common] admin-web/src/views/system/SystemConfigView.vue:304 [../../api/system] |
| 50 | admin-web/src/views/purchase/PurchaseContracts.vue | /purchase-contracts | 0 | 0 | 0 | 1 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P2 纯占位 | placeholder:admin-web/src/views/purchase/PurchaseContracts.vue:454 ‖ api:admin-web/src/views/purchase/PurchaseContracts.vue:287 [../../api] |
| 51 | admin-web/src/views/purchase/PurchaseOrders.vue | /purchase-orders | 0 | 0 | 0 | 1 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P2 纯占位 | placeholder:admin-web/src/views/purchase/PurchaseOrders.vue:339 ‖ api:admin-web/src/views/purchase/PurchaseOrders.vue:217 [../../api] |
| 52 | admin-web/src/views/report/PurchaseReports.vue | /reports/purchase | 0 | 0 | 0 | 1 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P2 纯占位 | placeholder:admin-web/src/views/report/PurchaseReports.vue:359 ‖ api:admin-web/src/views/report/PurchaseReports.vue:161 [../../api] admin-web/src/views/report/PurchaseReports.vue:162 [../../api/purchase] |
| 53 | admin-web/src/views/customer/CreditView.vue | /credit | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/customer/CreditView.vue:176 [../../api] |
| 54 | admin-web/src/views/customer/CustomerCareRules.vue | /customer-care | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/customer/CustomerCareRules.vue:115 [../../api] |
| 55 | admin-web/src/views/customer/CustomerDetail.vue | /customers/detail/:memberId | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/customer/CustomerDetail.vue:285 [../../api] |
| 56 | admin-web/src/views/customer/CustomerLifecycle.vue | /customer-lifecycle | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/customer/CustomerLifecycle.vue:78 [../../api] |
| 57 | admin-web/src/views/customer/CustomersView.vue | /customers | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/customer/CustomersView.vue:149 [../../api] admin-web/src/views/customer/CustomersView.vue:150 [../../api/customer] |
| 58 | admin-web/src/views/customer/CustomerTypes.vue | /customer-types | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/customer/CustomerTypes.vue:113 [../../api/customer] |
| 59 | admin-web/src/views/customer/CustomerVisits.vue | /customer-visits | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/customer/CustomerVisits.vue:294 [../../api] |
| 60 | admin-web/src/views/customer/LevelConfig.vue | /level-config | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/customer/LevelConfig.vue:126 [../../api] |
| 61 | admin-web/src/views/customer/MemberSystem.vue | /member-system | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/customer/MemberSystem.vue:92 [../../api] |
| 62 | admin-web/src/views/customer/PointsRules.vue | /points-rules | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/customer/PointsRules.vue:140 [../../api] |
| 63 | admin-web/src/views/customer/StoreValueCards.vue | /store-value-cards | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/customer/StoreValueCards.vue:179 [../../api] |
| 64 | admin-web/src/views/dashboard/MessageCenter.vue | /messages | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/dashboard/MessageCenter.vue:134 [../../api] |
| 65 | admin-web/src/views/dashboard/QuickEntryConfig.vue | /quick-entries | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | http:admin-web/src/views/dashboard/QuickEntryConfig.vue:235 admin-web/src/views/dashboard/QuickEntryConfig.vue:265 admin-web/src/views/dashboard/QuickEntryConfig.vue:274 |
| 66 | admin-web/src/views/dashboard/TodoList.vue | /todo-list | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | http:admin-web/src/views/dashboard/TodoList.vue:213 admin-web/src/views/dashboard/TodoList.vue:224 admin-web/src/views/dashboard/TodoList.vue:260 |
| 67 | admin-web/src/views/finance/BankAccounts.vue | /bank-accounts | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/finance/BankAccounts.vue:178 [../../api] |
| 68 | admin-web/src/views/finance/BillManagement.vue | /bill-management | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/finance/BillManagement.vue:161 [../../api] |
| 69 | admin-web/src/views/finance/CustomerStatements.vue | /customer-statements | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/finance/CustomerStatements.vue:152 [../../api] |
| 70 | admin-web/src/views/finance/ExpensesView.vue | /finance/expenses | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/finance/ExpensesView.vue:181 [../../api] |
| 71 | admin-web/src/views/finance/FinanceReport.vue | /fund-report | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/finance/FinanceReport.vue:205 [../../api] |
| 72 | admin-web/src/views/finance/HistoryBills.vue | /history-bills | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/finance/HistoryBills.vue:99 [../../api] |
| 73 | admin-web/src/views/finance/PaymentsView.vue | /payments | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/finance/PaymentsView.vue:135 [../../api] |
| 74 | admin-web/src/views/finance/ReconciliationView.vue | /finance/reconciliation | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/finance/ReconciliationView.vue:227 [../../api] |
| 75 | admin-web/src/views/instant-retail/InstantRetailConfig.vue | /instant-retail/config | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/instant-retail/InstantRetailConfig.vue:286 [../../api] |
| 76 | admin-web/src/views/instant-retail/InstantRetailDelivery.vue | /instant-retail/delivery | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/instant-retail/InstantRetailDelivery.vue:115 [../../api] |
| 77 | admin-web/src/views/instant-retail/InstantRetailOrders.vue | /instant-retail/orders | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/instant-retail/InstantRetailOrders.vue:310 [../../api] |
| 78 | admin-web/src/views/instant-retail/InstantRetailPayment.vue | /instant-retail/payment | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/instant-retail/InstantRetailPayment.vue:128 [../../api] |
| 79 | admin-web/src/views/instant-retail/InstantRetailPickup.vue | /instant-retail/pickup | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 注释自证线索 x1（后端未实现/无数据源/空态/mock 等**散文证据**，不计入命中数，详见「注释线索」节 NEEDS_EYE） | P3 干净 | api:admin-web/src/views/instant-retail/InstantRetailPickup.vue:381 [../../api] |
| 80 | admin-web/src/views/instant-retail/InstantRetailSync.vue | /instant-retail/sync | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/instant-retail/InstantRetailSync.vue:202 [../../api] |
| 81 | admin-web/src/views/instant-retail/RetailAnnouncement.vue | /instant-retail/announcements | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/instant-retail/RetailAnnouncement.vue:109 [../../api] |
| 82 | admin-web/src/views/inventory/Inventory.vue | /inventory | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/inventory/Inventory.vue:139 [../../api] |
| 83 | admin-web/src/views/inventory/InventoryAlertConfig.vue | /inventory-alert-config | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/inventory/InventoryAlertConfig.vue:165 [../../api] |
| 84 | admin-web/src/views/inventory/InventoryAlerts.vue | /inventory-alerts | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/inventory/InventoryAlerts.vue:48 [../../api] |
| 85 | admin-web/src/views/inventory/InventoryBatch.vue | /inventory-batch | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/inventory/InventoryBatch.vue:264 [../../api] |
| 86 | admin-web/src/views/inventory/InventoryBatchPrice.vue | /inventory-batch-price | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/inventory/InventoryBatchPrice.vue:194 [../../api] |
| 87 | admin-web/src/views/inventory/InventoryCost.vue | /inventory-cost | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/inventory/InventoryCost.vue:122 [../../api] |
| 88 | admin-web/src/views/inventory/InventoryReports.vue | /inventory-reports /reports/inventory | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/inventory/InventoryReports.vue:180 [../../api] |
| 89 | admin-web/src/views/inventory/InventoryTransferCreate.vue | /inventory-transfer/create /inventory-transfer/edit/:id | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 注释自证线索 x1（后端未实现/无数据源/空态/mock 等**散文证据**，不计入命中数，详见「注释线索」节 NEEDS_EYE） | P3 干净 | api:admin-web/src/views/inventory/InventoryTransferCreate.vue:266 [../../api] |
| 90 | admin-web/src/views/inventory/InventoryTransferDetail.vue | /inventory-transfer/detail/:id | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 注释自证线索 x1（后端未实现/无数据源/空态/mock 等**散文证据**，不计入命中数，详见「注释线索」节 NEEDS_EYE） | P3 干净 | api:admin-web/src/views/inventory/InventoryTransferDetail.vue:214 [../../api] |
| 91 | admin-web/src/views/LoginView.vue | /login | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 注释自证线索 x1（后端未实现/无数据源/空态/mock 等**散文证据**，不计入命中数，详见「注释线索」节 NEEDS_EYE） | P3 干净 | api:admin-web/src/views/LoginView.vue:176 [../api] |
| 92 | admin-web/src/views/marketing/AftersaleView.vue | /aftersale | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/marketing/AftersaleView.vue:190 [../../api] |
| 93 | admin-web/src/views/marketing/CouponManage.vue | /marketing/coupon | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/marketing/CouponManage.vue:204 [../../api] |
| 94 | admin-web/src/views/marketing/FlashSale.vue | /marketing/flash-sale | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/marketing/FlashSale.vue:208 [../../api] |
| 95 | admin-web/src/views/marketing/MarketingMaterial.vue | /marketing/materials | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 注释自证线索 x3（后端未实现/无数据源/空态/mock 等**散文证据**，不计入命中数，详见「注释线索」节 NEEDS_EYE） | P3 干净 | api:admin-web/src/views/marketing/MarketingMaterial.vue:404 [@/api] |
| 96 | admin-web/src/views/order/OrderBoardView.vue | /order-board | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/order/OrderBoardView.vue:119 [../../api] |
| 97 | admin-web/src/views/order/OrderCenterView.vue | /order-center | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 注释自证线索 x1（后端未实现/无数据源/空态/mock 等**散文证据**，不计入命中数，详见「注释线索」节 NEEDS_EYE） | P3 干净 | api:admin-web/src/views/order/OrderCenterView.vue:281 [@/api] |
| 98 | admin-web/src/views/order/Orders.vue | /orders | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/order/Orders.vue:168 [../../api] |
| 99 | admin-web/src/views/order/OrderSyncView.vue | /order-sync | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 注释自证线索 x1（后端未实现/无数据源/空态/mock 等**散文证据**，不计入命中数，详见「注释线索」节 NEEDS_EYE） | P3 干净 | api:admin-web/src/views/order/OrderSyncView.vue:225 [../../api] |
| 100 | admin-web/src/views/order/OrderTimeoutView.vue | /order-timeout | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/order/OrderTimeoutView.vue:212 [../../api] |
| 101 | admin-web/src/views/pos/CollectionView.vue | /collection /pos/collection | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/pos/CollectionView.vue:104 [../../api] |
| 102 | admin-web/src/views/pos/CouponVerifyView.vue | /pos/coupon-verify | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/pos/CouponVerifyView.vue:144 [../../api] admin-web/src/views/pos/CouponVerifyView.vue:145 [../../api] |
| 103 | admin-web/src/views/pos/DailySettleView.vue | /pos/daily-settle | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/pos/DailySettleView.vue:110 [../../api] |
| 104 | admin-web/src/views/pos/HoldOrderView.vue | /pos/hold-order | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/pos/HoldOrderView.vue:58 [../../api] |
| 105 | admin-web/src/views/pos/MemberView.vue | /pos/member | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/pos/MemberView.vue:66 [../../api] |
| 106 | admin-web/src/views/pos/OperationLogView.vue | /pos/operation-log | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/pos/OperationLogView.vue:131 [../../api] |
| 107 | admin-web/src/views/pos/OrderFulfillView.vue | /pos/order-fulfill | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/pos/OrderFulfillView.vue:87 [../../api] |
| 108 | admin-web/src/views/pos/SaleBillDetail.vue | /sale-bills/:billNo /pos/sale-bills/:billNo | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/pos/SaleBillDetail.vue:122 [../../api] |
| 109 | admin-web/src/views/pos/SaleBillsView.vue | /sale-bills /pos/sale-bills | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/pos/SaleBillsView.vue:75 [../../api] |
| 110 | admin-web/src/views/pos/SaleReturnView.vue | /sale-returns /pos/sale-return | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/pos/SaleReturnView.vue:130 [../../api] |
| 111 | admin-web/src/views/pos/ShiftDetailView.vue | /pos/shift/:id | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/pos/ShiftDetailView.vue:189 [../../api] |
| 112 | admin-web/src/views/pos/ShiftView.vue | /pos/shift | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/pos/ShiftView.vue:129 [../../api] |
| 113 | admin-web/src/views/pos/StoreDashboardView.vue | /pos/dashboard | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/pos/StoreDashboardView.vue:79 [../../api] |
| 114 | admin-web/src/views/product/Brands.vue | /products/brands | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/product/Brands.vue:82 [../../api] |
| 115 | admin-web/src/views/product/PricesView.vue | /prices | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/product/PricesView.vue:254 [../../api] |
| 116 | admin-web/src/views/product/ProductCategories.vue | /products/categories | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/product/ProductCategories.vue:149 [../../api] |
| 117 | admin-web/src/views/product/ProductImport.vue | /products/import | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/product/ProductImport.vue:63 [../../api] |
| 118 | admin-web/src/views/product/ProductReview.vue | /products/reviews | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 注释自证线索 x2（后端未实现/无数据源/空态/mock 等**散文证据**，不计入命中数，详见「注释线索」节 NEEDS_EYE） | P3 干净 | api:admin-web/src/views/product/ProductReview.vue:307 [../../api] |
| 119 | admin-web/src/views/product/ProductTags.vue | /products/tags | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/product/ProductTags.vue:93 [../../api] |
| 120 | admin-web/src/views/product/TagGroups.vue | /products/tag-groups | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/product/TagGroups.vue:148 [../../api] |
| 121 | admin-web/src/views/product/Units.vue | /products/units | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/product/Units.vue:115 [../../api] |
| 122 | admin-web/src/views/purchase/PurchaseInStocks.vue | /purchase-in-stocks | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/purchase/PurchaseInStocks.vue:199 [../../api] |
| 123 | admin-web/src/views/purchase/PurchasePlans.vue | /purchase/plans | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/purchase/PurchasePlans.vue:173 [../../api] |
| 124 | admin-web/src/views/purchase/PurchaseReturnsView.vue | /purchase-returns | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/purchase/PurchaseReturnsView.vue:97 [../../api] |
| 125 | admin-web/src/views/purchase/Suppliers.vue | /suppliers | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/purchase/Suppliers.vue:404 [../../api/purchase] |
| 126 | admin-web/src/views/purchase/SupplierStatements.vue | /purchase/supplier-statements | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/purchase/SupplierStatements.vue:152 [../../api] |
| 127 | admin-web/src/views/RegisterView.vue | /register | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/RegisterView.vue:55 [../api] |
| 128 | admin-web/src/views/report/OnlinePaymentAnalysis.vue | /reports/online-payment | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/report/OnlinePaymentAnalysis.vue:149 [../../api] |
| 129 | admin-web/src/views/report/Reports.vue | /reports | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/report/Reports.vue:164 [../../api] admin-web/src/views/report/Reports.vue:165 [../../api] |
| 130 | admin-web/src/views/report/TransferReport.vue | /reports/transfer | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/report/TransferReport.vue:146 [../../api] |
| 131 | admin-web/src/views/sale/CollectionLinks.vue | /sales/collection-links | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/sale/CollectionLinks.vue:136 [../../api] |
| 132 | admin-web/src/views/sale/CommissionRules.vue | /sales/commission/rules | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/sale/CommissionRules.vue:112 [../../api] |
| 133 | admin-web/src/views/sale/CustomerPrices.vue | /sales/customer-prices | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/sale/CustomerPrices.vue:147 [../../api] |
| 134 | admin-web/src/views/sale/SalesOrderCreate.vue | /sales/create | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/sale/SalesOrderCreate.vue:281 [../../api] |
| 135 | admin-web/src/views/system/ApprovalDetail.vue | /system/approval/detail/:id | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/system/ApprovalDetail.vue:72 [../../api] |
| 136 | admin-web/src/views/system/ApprovalManage.vue | /system/approval/manage | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/system/ApprovalManage.vue:22 [../../api] |
| 137 | admin-web/src/views/system/AuditLogView.vue | /audit-log | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/system/AuditLogView.vue:178 [../../api] |
| 138 | admin-web/src/views/system/ConsumerAddress.vue | /consumer-addresses | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/system/ConsumerAddress.vue:63 [../../api] |
| 139 | admin-web/src/views/system/DepartmentManage.vue | /department-manage | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/system/DepartmentManage.vue:117 [../../api] |
| 140 | admin-web/src/views/system/EmployeesView.vue | /employees | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/system/EmployeesView.vue:143 [../../api] |
| 141 | admin-web/src/views/system/ErrorLogView.vue | /error-log | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/system/ErrorLogView.vue:155 [../../api] |
| 142 | admin-web/src/views/system/FeedbackView.vue | /system/feedback | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/system/FeedbackView.vue:142 [../../api] |
| 143 | admin-web/src/views/system/MyApprovals.vue | /system/approval/my | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/system/MyApprovals.vue:85 [../../api] |
| 144 | admin-web/src/views/system/OrganizationView.vue | /organization | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/system/OrganizationView.vue:218 [../../api/system] admin-web/src/views/system/OrganizationView.vue:219 [../../api/pos] admin-web/src/views/system/OrganizationView.vue:220 [../../api] |
| 145 | admin-web/src/views/system/PositionManage.vue | /position-manage | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/system/PositionManage.vue:136 [../../api] |
| 146 | admin-web/src/views/system/ReportPermission.vue | /report-permissions | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/system/ReportPermission.vue:50 [../../api] |
| 147 | admin-web/src/views/system/StoresView.vue | /stores | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/system/StoresView.vue:230 [../../api] |
| 148 | admin-web/src/views/system/System.vue | /system | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/system/System.vue:235 [../../api] |
| 149 | admin-web/src/views/system/SystemRoles.vue | /system/roles | 0 | 0 | 0 | 0 | 0 | 0 | 否（有可解析接口调用） | 无（静态扫描未命中） | P3 干净 | api:admin-web/src/views/system/SystemRoles.vue:223 [../../api] |
| 150 | admin-web/src/views/components/WorkflowFlowChart.vue | 无路由(未挂载) | 0 | 0 | 0 | 0 | 0 | 0 | 是（无任何接口引用） | 无任何接口 import / HTTP 调用 | UNKNOWN（待人工） | 无命中 |
| 151 | admin-web/src/views/instant-retail/InstantRetailOrderBoard.vue | /instant-retail/order-board | 0 | 0 | 0 | 0 | 0 | 0 | 是（无任何接口引用） | 无任何接口 import / HTTP 调用 | UNKNOWN（待人工） | 无命中 |
| 152 | admin-web/src/views/instant-retail/InstantRetailPlatform.vue | /instant-retail/platform | 0 | 0 | 0 | 0 | 0 | 0 | 是（无任何接口引用） | 无任何接口 import / HTTP 调用 | UNKNOWN（待人工） | 无命中 |
| 153 | admin-web/src/views/instant-retail/InstantRetailReport.vue | /instant-retail/report | 0 | 0 | 0 | 0 | 0 | 0 | 是（无任何接口引用） | 无任何接口 import / HTTP 调用 | UNKNOWN（待人工） | 无命中 |
| 154 | admin-web/src/views/NotFound.vue | /:pathMatch(.*)* | 0 | 0 | 0 | 0 | 0 | 0 | 是（无任何接口引用） | 无任何接口 import / HTTP 调用 | UNKNOWN（待人工） | 无命中 |
| 155 | admin-web/src/views/product/ProductReviewWorkflow.vue | /products/review-workflow | 0 | 0 | 0 | 0 | 0 | 0 | 是（无任何接口引用） | 无任何接口 import / HTTP 调用 | UNKNOWN（待人工） | 无命中 |
| 156 | admin-web/src/views/product/ReviewDelegation.vue | /products/review-delegation | 0 | 0 | 0 | 0 | 0 | 0 | 是（无任何接口引用） | 无任何接口 import / HTTP 调用 | UNKNOWN（待人工） | 无命中 |
| 157 | admin-web/src/views/system/SystemMonitorManage.vue | /monitor-manage | 0 | 0 | 0 | 0 | 0 | 0 | 是（无任何接口引用） | 无任何接口 import / HTTP 调用 | UNKNOWN（待人工） | 无命中 |

**表行数 = 157**（与摘要「总页数」一致，脚本自检项）。

## 脚本原始输出（TSV，逐页一行，可机读复算）

```tsv
SEVERITY	COMPONENT	ROUTE_PATHS	MOCK	RANDOM	FAKE_CN	PLACEHOLDER	CATCH_EMPTY	MISSING_EXPORT	API_REF	API_RESOLVABLE	API_IMPORT_UNRESOLVED	OTHER_IMPORT_UNRESOLVED	SILENT_FAIL
P0	admin-web/src/views/components/PlatformPanel.vue	无路由(未挂载)	0	3	0	0	0	0	N	N	0	0	Y
P1	admin-web/src/views/customer/CustomerProfile.vue	/customer-profile	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/customer/CustomerSegments.vue	/customer-segments	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/customer/CustomerTags.vue	/customer-tags	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/dashboard/Dashboard.vue	/dashboard	0	0	0	0	0	0	Y	Y	0	0	Y
P1	admin-web/src/views/finance/FinanceCollection.vue	/finance/collection	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/finance/FinanceDashboard.vue	/finance/dashboard	0	0	0	0	0	0	Y	Y	0	0	Y
P1	admin-web/src/views/finance/FinanceProfit.vue	/finance/profit	0	0	0	0	0	0	Y	Y	0	0	Y
P1	admin-web/src/views/finance/PaymentsNewView.vue	/finance/payments	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/finance/ReceiptsView.vue	/finance/receipts	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/finance/ReceivablesPayables.vue	/finance/receivables-payables	0	0	0	0	0	0	Y	Y	0	0	Y
P1	admin-web/src/views/instant-retail/InstantRetailDashboard.vue	/instant-retail/dashboard	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/instant-retail/InstantRetailShelf.vue	/instant-retail/shelf	3	0	0	0	2	0	Y	Y	0	0	N
P1	admin-web/src/views/inventory/InventoryCheck.vue	/inventory-check	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/inventory/InventoryPriceQuote.vue	/inventory-price-quote	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/inventory/InventoryShareConfig.vue	/inventory-share-config	0	0	0	0	2	0	Y	Y	0	0	N
P1	admin-web/src/views/inventory/InventoryTransfer.vue	/inventory-transfer	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/marketing/FullReduction.vue	/marketing/full-reduction	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/marketing/MarketingDashboard.vue	/marketing/dashboard	0	0	0	0	0	0	Y	Y	0	0	Y
P1	admin-web/src/views/marketing/MarketingGiftRule.vue	/marketing/gift-rule	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/marketing/MarketingLimitedDiscount.vue	/marketing/limited-discount	0	0	0	0	2	0	Y	Y	0	0	N
P1	admin-web/src/views/marketing/MarketingPointsMall.vue	/marketing/points-mall	2	0	0	0	0	0	Y	Y	0	0	N
P1	admin-web/src/views/marketing/MarketingTags.vue	/marketing/tags	0	0	0	0	2	0	Y	Y	0	0	N
P1	admin-web/src/views/marketing/MarketingView.vue	/marketing	0	0	0	0	2	0	Y	Y	0	0	N
P1	admin-web/src/views/order/OrderAftersaleView.vue	/order-aftersale	0	0	0	0	2	0	Y	Y	0	0	N
P1	admin-web/src/views/order/OrderExceptionView.vue	/order-exception	0	1	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/order/OrderProductMapView.vue	/order-product-map	0	1	0	0	0	0	Y	Y	0	0	N
P1	admin-web/src/views/order/OrderRoutingView.vue	/order-routing	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/pos/CashierView.vue	/pos/cashier	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/pos/StoreControlView.vue	/pos/store-control	0	0	0	0	0	0	Y	Y	0	0	Y
P1	admin-web/src/views/product/ProductCombo.vue	/products/combo	0	0	0	0	2	0	Y	Y	0	0	N
P1	admin-web/src/views/product/ProductReviewTasks.vue	/products/review-tasks	4	0	0	0	0	0	Y	Y	0	0	N
P1	admin-web/src/views/product/Products.vue	/products	0	0	0	0	2	0	Y	Y	0	0	N
P1	admin-web/src/views/product/ProductTagRelation.vue	/products/tag-relation	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/purchase/PurchasePayments.vue	/purchase-payments	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/report/CollectionAnalysis.vue	/reports/collection-analysis	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/report/CustomerAnalysis.vue	/reports/customers	0	0	0	0	2	0	Y	Y	0	0	Y
P1	admin-web/src/views/report/CustomReport.vue	/reports/custom-report	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/report/ReportsEmployees.vue	/reports/employees	0	0	0	0	1	0	Y	Y	0	0	Y
P1	admin-web/src/views/report/ReportsProducts.vue	/reports/products	0	0	0	0	1	0	Y	Y	0	0	Y
P1	admin-web/src/views/report/ReportsStores.vue	/reports/stores	0	0	0	0	1	0	Y	Y	0	0	Y
P1	admin-web/src/views/report/SalesAnalysis.vue	/reports/sales-analysis	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/sale/CommissionRecords.vue	/sales/commission/records	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/sale/SalesReports.vue	/sales/reports	0	0	0	0	0	0	Y	Y	0	0	Y
P1	admin-web/src/views/system/ApprovalRules.vue	/system/approval/rules	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/system/MiniappConfigView.vue	/system/miniapp	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/system/MonitorView.vue	/monitor	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/system/PaymentConfigView.vue	/system/payment	0	0	0	0	1	0	Y	Y	0	0	N
P1	admin-web/src/views/system/SystemConfigView.vue	/system/config	0	0	0	0	3	0	Y	Y	0	0	N
P2	admin-web/src/views/purchase/PurchaseContracts.vue	/purchase-contracts	0	0	0	1	0	0	Y	Y	0	0	N
P2	admin-web/src/views/purchase/PurchaseOrders.vue	/purchase-orders	0	0	0	1	0	0	Y	Y	0	0	N
P2	admin-web/src/views/report/PurchaseReports.vue	/reports/purchase	0	0	0	1	0	0	Y	Y	0	0	N
P3	admin-web/src/views/customer/CreditView.vue	/credit	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/customer/CustomerCareRules.vue	/customer-care	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/customer/CustomerDetail.vue	/customers/detail/:memberId	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/customer/CustomerLifecycle.vue	/customer-lifecycle	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/customer/CustomersView.vue	/customers	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/customer/CustomerTypes.vue	/customer-types	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/customer/CustomerVisits.vue	/customer-visits	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/customer/LevelConfig.vue	/level-config	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/customer/MemberSystem.vue	/member-system	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/customer/PointsRules.vue	/points-rules	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/customer/StoreValueCards.vue	/store-value-cards	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/dashboard/MessageCenter.vue	/messages	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/dashboard/QuickEntryConfig.vue	/quick-entries	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/dashboard/TodoList.vue	/todo-list	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/finance/BankAccounts.vue	/bank-accounts	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/finance/BillManagement.vue	/bill-management	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/finance/CustomerStatements.vue	/customer-statements	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/finance/ExpensesView.vue	/finance/expenses	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/finance/FinanceReport.vue	/fund-report	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/finance/HistoryBills.vue	/history-bills	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/finance/PaymentsView.vue	/payments	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/finance/ReconciliationView.vue	/finance/reconciliation	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/instant-retail/InstantRetailConfig.vue	/instant-retail/config	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/instant-retail/InstantRetailDelivery.vue	/instant-retail/delivery	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/instant-retail/InstantRetailOrders.vue	/instant-retail/orders	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/instant-retail/InstantRetailPayment.vue	/instant-retail/payment	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/instant-retail/InstantRetailPickup.vue	/instant-retail/pickup	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/instant-retail/InstantRetailSync.vue	/instant-retail/sync	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/instant-retail/RetailAnnouncement.vue	/instant-retail/announcements	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/inventory/Inventory.vue	/inventory	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/inventory/InventoryAlertConfig.vue	/inventory-alert-config	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/inventory/InventoryAlerts.vue	/inventory-alerts	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/inventory/InventoryBatch.vue	/inventory-batch	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/inventory/InventoryBatchPrice.vue	/inventory-batch-price	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/inventory/InventoryCost.vue	/inventory-cost	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/inventory/InventoryReports.vue	/inventory-reports|/reports/inventory	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/inventory/InventoryTransferCreate.vue	/inventory-transfer/create|/inventory-transfer/edit/:id	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/inventory/InventoryTransferDetail.vue	/inventory-transfer/detail/:id	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/LoginView.vue	/login	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/marketing/AftersaleView.vue	/aftersale	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/marketing/CouponManage.vue	/marketing/coupon	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/marketing/FlashSale.vue	/marketing/flash-sale	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/marketing/MarketingMaterial.vue	/marketing/materials	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/order/OrderBoardView.vue	/order-board	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/order/OrderCenterView.vue	/order-center	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/order/Orders.vue	/orders	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/order/OrderSyncView.vue	/order-sync	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/order/OrderTimeoutView.vue	/order-timeout	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/pos/CollectionView.vue	/collection|/pos/collection	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/pos/CouponVerifyView.vue	/pos/coupon-verify	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/pos/DailySettleView.vue	/pos/daily-settle	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/pos/HoldOrderView.vue	/pos/hold-order	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/pos/MemberView.vue	/pos/member	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/pos/OperationLogView.vue	/pos/operation-log	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/pos/OrderFulfillView.vue	/pos/order-fulfill	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/pos/SaleBillDetail.vue	/sale-bills/:billNo|/pos/sale-bills/:billNo	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/pos/SaleBillsView.vue	/sale-bills|/pos/sale-bills	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/pos/SaleReturnView.vue	/sale-returns|/pos/sale-return	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/pos/ShiftDetailView.vue	/pos/shift/:id	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/pos/ShiftView.vue	/pos/shift	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/pos/StoreDashboardView.vue	/pos/dashboard	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/product/Brands.vue	/products/brands	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/product/PricesView.vue	/prices	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/product/ProductCategories.vue	/products/categories	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/product/ProductImport.vue	/products/import	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/product/ProductReview.vue	/products/reviews	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/product/ProductTags.vue	/products/tags	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/product/TagGroups.vue	/products/tag-groups	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/product/Units.vue	/products/units	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/purchase/PurchaseInStocks.vue	/purchase-in-stocks	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/purchase/PurchasePlans.vue	/purchase/plans	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/purchase/PurchaseReturnsView.vue	/purchase-returns	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/purchase/Suppliers.vue	/suppliers	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/purchase/SupplierStatements.vue	/purchase/supplier-statements	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/RegisterView.vue	/register	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/report/OnlinePaymentAnalysis.vue	/reports/online-payment	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/report/Reports.vue	/reports	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/report/TransferReport.vue	/reports/transfer	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/sale/CollectionLinks.vue	/sales/collection-links	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/sale/CommissionRules.vue	/sales/commission/rules	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/sale/CustomerPrices.vue	/sales/customer-prices	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/sale/SalesOrderCreate.vue	/sales/create	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/system/ApprovalDetail.vue	/system/approval/detail/:id	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/system/ApprovalManage.vue	/system/approval/manage	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/system/AuditLogView.vue	/audit-log	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/system/ConsumerAddress.vue	/consumer-addresses	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/system/DepartmentManage.vue	/department-manage	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/system/EmployeesView.vue	/employees	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/system/ErrorLogView.vue	/error-log	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/system/FeedbackView.vue	/system/feedback	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/system/MyApprovals.vue	/system/approval/my	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/system/OrganizationView.vue	/organization	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/system/PositionManage.vue	/position-manage	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/system/ReportPermission.vue	/report-permissions	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/system/StoresView.vue	/stores	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/system/System.vue	/system	0	0	0	0	0	0	Y	Y	0	0	N
P3	admin-web/src/views/system/SystemRoles.vue	/system/roles	0	0	0	0	0	0	Y	Y	0	0	N
UNKNOWN	admin-web/src/views/components/WorkflowFlowChart.vue	无路由(未挂载)	0	0	0	0	0	0	N	N	0	0	N
UNKNOWN	admin-web/src/views/instant-retail/InstantRetailOrderBoard.vue	/instant-retail/order-board	0	0	0	0	0	0	N	N	0	0	N
UNKNOWN	admin-web/src/views/instant-retail/InstantRetailPlatform.vue	/instant-retail/platform	0	0	0	0	0	0	N	N	0	0	N
UNKNOWN	admin-web/src/views/instant-retail/InstantRetailReport.vue	/instant-retail/report	0	0	0	0	0	0	N	N	0	0	N
UNKNOWN	admin-web/src/views/NotFound.vue	/:pathMatch(.*)*	0	0	0	0	0	0	N	N	0	0	N
UNKNOWN	admin-web/src/views/product/ProductReviewWorkflow.vue	/products/review-workflow	0	0	0	0	0	0	N	N	0	0	N
UNKNOWN	admin-web/src/views/product/ReviewDelegation.vue	/products/review-delegation	0	0	0	0	0	0	N	N	0	0	N
UNKNOWN	admin-web/src/views/system/SystemMonitorManage.vue	/monitor-manage	0	0	0	0	0	0	N	N	0	0	N
```

### COUNTS（脚本 stdout 摘要原样）

```json
{
 "GENERATED_BY": "parse-page-quality.cjs",
 "ROOT": "D:/Users/ZXQL/wt-agents/WB-REFACTOR-P0",
 "ROUTES_CSV": "<工作树外临时目录>/table-a-routes.csv",
 "ROUTES_CSV_ROWS": 164,
 "VIEWS_DIR": "admin-web/src/views",
 "TOTAL_PAGES": 157,
 "P0": 1,
 "P1": 48,
 "P2": 3,
 "P3": 97,
 "UNKNOWN": 8,
 "ZERO_MOCK_PAGES": 154,
 "NO_API_REFERENCE_PAGES": 9,
 "API_RESOLVABLE_PAGES": 148,
 "API_IMPORT_UNRESOLVABLE_PAGES": 0,
 "CATCH_EMPTY_PAGES": 38,
 "MISSING_EXPORT_PAGES": 0,
 "SILENT_FAIL_PAGES": 12,
 "UNROUTED_FILES": 2,
 "TOTAL_HITS": {
  "mock": 9,
  "random": 5,
  "fakeCn": 0,
  "placeholder": 3,
  "catchEmpty": 49,
  "errorReset": 27,
  "missingExport": 0,
  "apiResolved": 164,
  "apiMissing": 0,
  "directHttp": 12,
  "otherMissingMod": 0
 },
 "MANUAL_REVIEW_APPLIED": 1,
 "COMMENT_DROPPED_HITS": 21
}
```

## 注释线索（散文证据：不计入命中数，但属「后端未实现 / 无数据源 / 恒空 / mock」线索，逐条待人工）

> 脚本把注释行里的 mock / TODO / 模拟 等关键词从**计数**中剔除（避免把说明文字当成运行时假数据），但如实列在这里；
> 带 `[DEV_NOTE]` 标记的是命中「未实现 / 暂未 / 无数据源 / 空态 / mock / 演示数据」等自证表述的行。

```
[DEV_NOTE] admin-web/src/views/marketing/MarketingGiftRule.vue:217 (mock: // ==================== Mock 数据 ====================)
[DEV_NOTE] admin-web/src/views/marketing/MarketingPointsMall.vue:283 (mock: // ==================== Mock 数据 ====================)
[DEV_NOTE] admin-web/src/views/order/OrderExceptionView.vue:260 (mock: // ── Mock 数据 ──)
[DEV_NOTE] admin-web/src/views/order/OrderProductMapView.vue:280 (mock: // ── Mock 数据 ──)
[DEV_NOTE] admin-web/src/views/order/OrderRoutingView.vue:270 (mock: // ─── Mock 数据 ───)
[DEV_NOTE] admin-web/src/views/product/ProductCombo.vue:1257 (placeholder: // TODO: 套装逐日销售趋势无数据源（t_product_bundle 仅有 sales_count 累计值），显)
[DEV_NOTE] admin-web/src/views/product/ProductCombo.vue:1303 (placeholder: // TODO: 按分类的套装优惠数据无数据源（统计接口仅返回汇总金额），显示空态)
[DEV_NOTE] admin-web/src/views/product/ProductReviewTasks.vue:268 (mock: // ==================== Mock 数据 ====================)
[DEV_NOTE] admin-web/src/views/report/CollectionAnalysis.vue:505 (placeholder: // 超时率趋势：后端仅有实时区间分布，无历史逐日数据源，显示空态（TODO: 接入超时率历史统计后填充）)
[DEV_NOTE] admin-web/src/views/system/SystemConfigView.vue:358 (fakeCn: // 备份历史从真实接口加载（备份目录文件列表），不再内置模拟数据)
[DEV_NOTE] admin-web/src/views/instant-retail/InstantRetailPickup.vue:448 (mock: // Mock 数据)
[DEV_NOTE] admin-web/src/views/inventory/InventoryTransferCreate.vue:362 (mock: // 加载失败时使用 mock 数据（编辑模式）)
[DEV_NOTE] admin-web/src/views/inventory/InventoryTransferDetail.vue:295 (mock: // 使用 mock 数据)
[DEV_NOTE] admin-web/src/views/LoginView.vue:256 (fakeCn: // 幂等初始化演示数据（失败不阻塞进入）)
[DEV_NOTE] admin-web/src/views/marketing/MarketingMaterial.vue:716 (placeholder: // TODO: 素材上传能力依赖对象存储/静态文件服务，后端暂未实现（仅 t_upload_file 配额表，无写文件)
[DEV_NOTE] admin-web/src/views/marketing/MarketingMaterial.vue:717 (mock: // 当前保留前端占位流程，不写入 mock 数据；接入存储后改为 multipart 上传并调用 POST /admi)
[DEV_NOTE] admin-web/src/views/marketing/MarketingMaterial.vue:739 (placeholder: // TODO: 素材上传/静态存储能力接入后，图片类素材将展示真实文件)
[DEV_NOTE] admin-web/src/views/order/OrderCenterView.vue:451 (placeholder: // TODO: 手动同步已接入平台时调用 /admin/instant-retail/configs/:platfor)
[DEV_NOTE] admin-web/src/views/order/OrderSyncView.vue:227 (mock: // ─── Mock 数据 ───)
[DEV_NOTE] admin-web/src/views/product/ProductReview.vue:571 (mock: // 后端接口可能还没实现，使用 mock 成功)
[DEV_NOTE] admin-web/src/views/product/ProductReview.vue:619 (mock: // 后端接口可能还没实现，使用 mock 成功)
```

## 未验运行态声明（全局）

- 本台账全部来自**静态源码扫描**，未启动任何页面、未跑构建、未打后端；`node_modules` 在本工作树不存在，因此 `import` 可解析性只按盘上文件判断，第三方包未校验。
- 盘上事实核对：接口层是 `admin-web/src/api.ts`（barrel，24 个域文件在 `admin-web/src/api/`），`import ... from "../../api"` **能解析到该 barrel**，脚本未把它记成缺失模块；本台账记的"缺失接口线索"= 页面 import 的名字在 api 层（含 `export *` 再导出）里找不到导出（见 MISSING_EXPORT 列）。
- 静态 import 解析率：可解析接口调用页数 148，接口引用完全不可解析页数 0，无任何接口引用页数 9（后者含 2 个未挂载路由的 views 子组件）。
- 每一行的「严重度」= **现状登记**，不等于该页面可交付。

## 抽查与纠偏

### 逐页 Read 复核（步骤3，抽 P0/P1/P2 共 7 组页面）

| 抽查对象（文件:行区间） | 脚本原判 | 复核结论 | 依据 |
| --- | --- | --- | --- |
| admin-web/src/views/components/PlatformPanel.vue:232-271 | P0 冒充 LIVE（random x4，无接口引用） | 改判后成立 | 239 行 `Math.random() > 0.3` 伪造「连接测试结果」、266/282 行伪造同步条数 —— 均为无接口的假反馈，P0 成立；256 行随机密钥属无害随机 → 已进 MANUAL_REVIEW 剔除（误报 1 处）。 |
| admin-web/src/views/order/OrderExceptionView.vue:217 | P1 部分假（random x1 + catch 空兜底 x1） | 真阳性，无需改判 | 217 行在模板里直接渲染 `¥{{ (Math.random() * 300 + 50).toFixed(2) }}` 当「订单金额」—— 假数据以正式展示态出现，判定成立。 |
| admin-web/src/views/order/OrderProductMapView.vue:373-384 | P1 部分假（random x1） | 真阳性，无需改判 | 本地 SKU 搜索下拉用 `Array.from({length:8})` + 随机价造候选项，非无害抖动；判定成立。 |
| admin-web/src/views/instant-retail/InstantRetailShelf.vue:393/395/515 与 400-404/427-431 | P1 部分假（mock x3 + catch 空兜底 x3） | mock 成立；catchEmpty 属脚本误报，已按规则纠正 | 3 个 mock 变量都是 `const mockXxx = []` 死声明（脚本另报 mock 死声明）；402/429 行所在 catch 里**已有** `ElMessage.error(...)` 后才 `products.value = []`，属正常失败清空，不应算静默恒空 → 脚本已把这种情况改记 errorReset（不再驱动严重度）。 |
| admin-web/src/views/product/ProductReviewTasks.vue:268-275 | P1 部分假（mock x4） | 真阳性，语义补充 | mockPendingList/mockReviewedList/mockSubmittedList/mockDetail 全为空声明且正文无引用 —— 是「假数据脚手架被清空后未接线」，仍是需登记的现状，保留命中。 |
| admin-web/src/views/marketing/MarketingPointsMall.vue:286/288 与 320-324 | P1 部分假（mock x2 + catch 空兜底 x2） | mock 成立；catchEmpty 同属误报已纠正 | 320-324 行 catch 内先 `ElMessage.error(...)` 再 `products.value = []`，为正常失败清空 → 归 errorReset。 |
| admin-web/src/views/purchase/PurchaseContracts.vue:454、PurchaseOrders.vue:339、report/PurchaseReports.vue:359 | P2 纯占位（placeholder x1） | 真阳性，无需改判 | 三处均为 `ElMessage.info("…功能待实现")`，页面向用户明示未实现，占位定性成立（这些页同时有接口调用，已在「无真实 API 调用?」列如实显示）。 |

### 数字级纠偏（MANUAL_REVIEW，改数必须走这张表并重跑脚本）

| 文件:行号 | 类别 | 原判 | 改判 | 理由 | 脚本应用结果 |
| --- | --- | --- | --- | --- | --- |
| admin-web/src/views/components/PlatformPanel.vue:256 | random | P0 冒充 LIVE | P0 冒充 LIVE（random x3） | 该行 `chars.charAt(Math.floor(Math.random() * chars.length))` 是「重新生成签名密钥」的随机串生成，非假数据；2026-10-22 抽查 Read 232-271 行确认为无害随机，属脚本误报，予以剔除。239/266/282 三行（伪造连接测试结果、伪造同步条数）保留。 | APPLIED → 重算后 P0 冒充 LIVE |

另有两处**规则级**纠偏（不是逐行 hack，已写进扫描逻辑）：
- catch 窗口里若已存在 `ElMessage.error/warning/console.error` 等提示，则 `[]`/`{}` 归为 `errorReset`（正常失败清空），不再计入 `catchEmpty` 恒空候选、不再驱动严重度；
- 注释行里的 mock/TODO/模拟 关键词不计入命中数，但作为「注释线索」逐行登记（含 `未实现/无数据源/空态` 的散文自证），避免把说明文字当运行时假数据、也避免把真线索丢掉。

## 不得洗绿声明

本台账**只登记现状**：任何行（含 P3 干净 / P2 纯占位）都**不构成**「该页面已完成、已接通、可验收」的认定；
P0/P1/P2/UNKNOWN/NEEDS_EYE 一律视为**待整改项**。运行态、数据正确性、权限、后端契约均未经此台账验证。

## 收口补记（墨 · 2026-10-22）

本节由生成器一并产出（避免手改产物在复跑时被覆盖）：三方互锁 —— 摘要表 ↔ 逐页明细 ↔ 脚本 COUNTS 对
总页数 157 / P0=1 / P1=48 / P2=3 / P3=97 / UNKNOWN=8 逐项相等，
TSV 157 行 = 明细 157 行，`ROUTES_CSV_ROWS=164` 与矩阵10 `ROUTE_DECLARATIONS` 对齐。
校验器 `scripts/verify-inventory.cjs --strict` 已把这些守恒关系挂成退出码门禁。

- **「洗绿」反测已执行**：临时副本上把唯一 P0 页改判 `P3 干净` ⇒ `L40.P0 冒充 LIVE 条数`、`L40.P3 干净 条数`、`L40.明细P0=COUNTS.P0`、`L40.明细P3=COUNTS.P3` 四项同时报警，复原后归零。原始输出见同目录 `50-reverse-test-log.md`。
- **可复现性修复**：产物不再烤本机绝对路径（工作树外的 CSV 输入只登记 `<工作树外临时目录>/文件名`），计时 `ELAPSED_MS` 移出产物只打 stdout ⇒ 同输入连跑两次产物逐字节相同。
- **仍未解除的运行态缺口**：工作树内无 `node_modules`，本轮未 `build`、未起 dev server、未在浏览器逐页打开。P0/P1/P2 合计 52 页需真实环境逐页眼验后才能谈验收。
