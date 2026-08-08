# 任务卡：ache_r99_03 — R99-03 [P1] P1 常规页批量套模板 + 模块走查（阶段 3）

- **派发**：2026-08-08 凌舟（总负责人）
- **负责人**：阿澈（前端设计/开发）
- **优先级**：P1
- **项目根（新路径）**：`D:\Users\ZXQL\ZXQL-MS\wen-ssystem`

## 一、任务背景

工作台全页面设计（R99）阶段 3：R99-01（设计体系）+ R99-02（P0 23 页）已完成。本任务把 **P1 常规业务页批量套用四种骨架模板**，并分模块走查，让 152 页整体视觉统一、达到参考图精美度。

## 二、必读文件

1. `docs/tasks/current-tasks.md` R99-00/R99-01/R99-02/R99-03
2. `docs/design/工作台页面设计规范.md`（四种骨架规范）
3. `admin-web/src/styles/tokens.css` + `styles.css`（全局主题已生效）
4. R99-02 已精设计的 18 页代码（**风格标杆**）+ `docs/reports/R99-02-走查/` 截图
5. 参考图（需要时）：`D:\Huawei Share\Huawei Share\share_*.png` 两张

## 三、范围

以下模块中**未在 P0 完成**的业务页（P0 已做：LoginView/Dashboard/CashierView/Products/SalesOrderCreate/CustomersView/CustomerDetail/MemberSystem/Orders/OrderCenterView/OrderBoardView/Inventory/InventoryAlerts/InventoryBatch/ProductCategories/PricesView/ProductCombo/Reports/SalesAnalysis/CustomerAnalysis/SaleBillsView/HoldOrderView/CollectionView）：

- customer 剩余：CreditView/CustomerCareRules/CustomerLifecycle/CustomerProfile/CustomerSegments/CustomerTags/CustomerTypes/CustomerVisits/LevelConfig/PointsRules/StoreValueCards
- finance 全部 13：BankAccounts/BillManagement/CustomerStatements/ExpensesView/FinanceCollection/FinanceDashboard/FinanceProfit/FinanceReport/PaymentsNewView/PaymentsView/ReceiptsView/ReceivablesPayables/ReconciliationView
- instant-retail 全部 12：InstantRetailConfig/Dashboard/Delivery/OrderBoard/Orders/Payment/Pickup/Platform/Report/Shelf/Sync/RetailAnnouncement
- inventory 剩余 10：InventoryAlertConfig/InventoryBatchPrice/InventoryCheck/InventoryCost/InventoryPriceQuote/InventoryReports/InventoryShareConfig/InventoryTransfer/InventoryTransferCreate/InventoryTransferDetail
- marketing 全部 11：AftersaleView/CouponManage/FlashSale/FullReduction/MarketingDashboard/MarketingGiftRule/MarketingLimitedDiscount/MarketingMaterial/MarketingPointsMall/MarketingTags/MarketingView
- order 剩余 6：OrderAftersaleView/OrderExceptionView/OrderProductMapView/OrderRoutingView/OrderSyncView/OrderTimeoutView
- pos 剩余 11：CouponVerifyView/DailySettleView/MemberView/OperationLogView/OrderFulfillView/SaleReturnView/ShiftDetailView/ShiftView/StoreControlView/StoreDashboardView（+ 已做的 CashierView/CollectionView/HoldOrderView/SaleBillsView）
- product 剩余 11：Brands/ProductImport/ProductReview/ProductReviewTasks/ProductReviewWorkflow/ProductTagRelation/ProductTags/ReviewDelegation/TagGroups/Units（+ 已做的 Products/PricesView/ProductCategories/ProductCombo）
- purchase 全部 8：PurchaseContracts/PurchaseInStocks/PurchaseOrders/PurchasePayments/PurchasePlans/PurchaseReturnsView/Suppliers/SupplierStatements
- report 剩余 8：CollectionAnalysis/CustomReport/OnlinePaymentAnalysis/PurchaseReports/ReportsEmployees/ReportsProducts/ReportsStores/TransferReport
- sale 剩余 5：CollectionLinks/CommissionRecords/CommissionRules/CustomerPrices/SalesReports
- dashboard 剩余 3：MessageCenter/QuickEntryConfig/TodoList

合计约 98 页。**P2 不逐页改**：system 模块（配置/日志/监控）与低频页，全局主题自动生效，留 R99-04 抽查。

## 四、要求

- 每页按对应骨架落地：页头（标题 20px/700 + 说明 + 操作）、指标卡（stat-grid 大数字 tabular-nums）、筛选栏（filter-bar 卡片）、表格卡（table-card + footer 分页）、详情区块（detail-section 蓝竖条）、状态标签（语义色）、空态/加载态
- 用 R99-01 通用类与 tokens（--shadow-card/hover/modal、圆角、留白），风格与 P0 页一致
- **只改样式与模板结构，不动业务逻辑、接口、数据流**；不新增 UI 库
- 可分模块提交（如 finance、marketing、instant-retail 各一提交），最终推送 origin/main

## 五、验证

- `npm run build:check` exit 0（每批次提交前跑）
- 分模块走查截图（docs/reports/R99-03-*），重点模块抽查 0 空白页/0 结构崩溃
- 无回归（构建 + 关键页面可渲染）

## 六、验收标准

- P1 页全部按骨架落地，与 P0 风格无断层；152 页整体统一
- build:check 通过、截图齐备、无回归
- current-tasks.md 更新 R99-03 完成记录；任务卡归档

## 七、注意事项

- 全程简体中文；**禁止改动 backend/miniapp/app-mobile/saas-admin**
- 工作量大，按模块分批推进，先 finance/marketing/purchase/instant-retail 再其余；每批 build 通过后提交
- 回复验收要求（按全局 AGENTS.md）：引用本任务标识 R99-03、复述关键内容、给出完成结果与验证证据
