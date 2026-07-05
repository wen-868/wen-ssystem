# 当前任务

> 唯一任务文件，所有团队成员读取此文件获取任务。  
> 凌舟维护，每次分派新增轮次。  
> 最后更新：2026-07-05

---

## R1 — 2026-07-05 苏然测试报告 v2 [已完成，剩余未完成项转入 R3]

> 来源：苏然第二轮全局深度测试，16 个问题。  
> 阿坚/阿澈已提交部分修复，剩余未完成项转入 R3。

---

## R2 — 2026-07-05 凌舟后台验收 [已完成，剩余未完成项转入 R3]

> 来源：凌舟实际验收后台发现的数据完整性问题。  
> 已分派给墨和阿坚，转入 R3 统一跟踪。

---

## R3 — 2026-07-05 当前所有待办 [进行中]

> 整合 R1、R2 中未完成的任务，以及 R2 新增任务。

---

### 阿坚 · 后端任务

#### R3-1 客户 create API 补充 address/remark/settlementType
- 优先级：P0
- 负责人：阿坚
- 预计：0.5天
- 状态：待开始
- 文件：`backend/src/services/admin/customer.service.ts`（createCustomer L35-46）
- 问题：创建客户时只接受 name/mobile/customerType/staffId，update API 已支持 address/remark/settlementType，但 create API 未同步
- 修复：createCustomer 补充 address/remark/settlementType 参数，与 updateCustomer 字段对齐

#### R3-2 product_spu 添加 brand_id 外键
- 优先级：P0
- 负责人：阿坚
- 预计：0.5天
- 状态：待开始
- 文件：`backend/src/services/admin/product.service.ts`
- 问题：product_spu.brand 是 VARCHAR(128) 存储品牌名，但存在独立的 brand 表（id/name/logo）。前端传 brandId 数字 ID，后端当字符串存储
- 修复：添加 brand_id 字段（ALTER TABLE）；迁移现有 brand 字符串到 brand_id；后端 createProduct/updateProduct 改为接受 brandId

#### R3-3 前后端 API 路径不匹配
- 优先级：P1
- 负责人：阿坚
- 预计：0.5天
- 状态：待开始
- 文件：费用管理 `admin-web/src/api.ts`（L1972-1989）vs `backend/src/routes/expense.routes.ts`；审批 `admin-web/src/api.ts`（L2054-2091）vs `backend/src/routes/approval.routes.ts`
- 问题：费用管理前端调 `/api/admin/finance/expenses`，后端注册 `/api/admin/expenses`；审批前端调 `/api/admin/system/approval/...`，后端注册 `/api/admin/approval/...`。前端多加了 `/finance/` 和 `/system/` 段
- 修复：以后端路径为准，前端去掉多余的路径段

#### R3-4 审批规则补充 EXPENSE 业务类型
- 优先级：P1
- 负责人：阿坚
- 预计：0.5天
- 状态：待开始
- 文件：`backend/src/routes/approval.routes.ts` + 审批 service
- 问题：审批规则支持 PURCHASE/SALE/REFUND/PRICE_CHANGE/CREDIT_LIMIT，缺少 EXPENSE。费用审批走独立流程（ExpensesView 内置 approve/void）
- 修复：补充 EXPENSE 类型，确认是否纳入系统审批流程

#### R3-5 剩余 try-catch 绕过 error-handler（约 130 处）
- 优先级：P1
- 负责人：阿坚
- 预计：1.5天
- 状态：待开始
- 文件：43 个 controller 文件（top 10 已修复，剩余约 130 处）
- 问题：controller 中 try-catch 直接 res.status().json() 返回错误，导致 errorHandler、飞书告警、错误日志持久化失效
- 修复：移除 controller 中 try-catch，让 asyncHandler 自动传递错误到 errorHandler

#### R3-6 剩余 as any 类型断言（约 300 处）
- 优先级：P2
- 负责人：阿坚
- 预计：1天
- 状态：待开始
- 文件：stock-check.service.ts(26)、transfer-execution.service.ts(20)、store-control.service.ts(19) 等
- 问题：338 处 as any 类型断言，top 10 文件已修复，剩余约 300 处
- 修复：替换为安全的类型定义

#### R3-7 胖路由 admin.routes.ts 拆分
- 优先级：P2
- 负责人：阿坚
- 预计：1天
- 状态：待开始
- 文件：`backend/src/routes/admin.routes.ts`
- 问题：单文件包含 83 个端点，难以维护
- 修复：按业务模块拆分为独立路由文件

---

### 墨 · 前端任务

#### R3-8 客户管理新增表单补全字段
- 优先级：P0
- 负责人：墨
- 预计：2天
- 状态：待开始
- 文件：`admin-web/src/views/CustomersView.vue`（新增弹窗 L64-83）
- 问题：新增客户表单仅 3 个字段（name、mobile、customerType），数据库 member 表有 17 个字段
- 修复：补 address、remark、settlementType、staffId 共 4 个字段；列表也补上 address、settlementType、points、levelCode、status、remark 列

#### R3-9 商品信息表单补全 14 个缺失字段
- 优先级：P0
- 负责人：墨
- 预计：2天
- 状态：待开始
- 文件：`admin-web/src/views/Products.vue`
- 问题：SPU 层缺 unit/specs/sortNo/isNew/isRecommend/description/imageUrls/marketingTags；价格层缺 costPrice（硬编码为0）/storePrice；SKU 层缺 volume/packaging/baseUnit/boxUnit；品牌创建时未发送字段
- 修复：补全所有缺失字段；修复品牌 Bug（创建时发送 brandId）；列表展示库存 availableQty；编辑时一并设置标签

#### R3-10 分类支持三级（前端硬限制放开）
- 优先级：P1
- 负责人：墨
- 预计：0.5天
- 状态：待开始
- 文件：`admin-web/src/views/ProductCategories.vue` L333-337
- 问题：allowDrop 中 dropNode.level < 2 硬限制最多 2 级分类
- 修复：改为 dropNode.level < 3 支持三级分类

#### R3-11 审批规则新增 EXPENSE 类型
- 优先级：P1
- 负责人：墨
- 预计：0.5天
- 状态：待开始
- 文件：`admin-web/src/views/ApprovalRules.vue` L103-109
- 问题：审批规则业务类型缺少 EXPENSE
- 修复：补充 EXPENSE 选项

#### R3-12 admin-web api.ts 错误处理
- 优先级：P0
- 负责人：墨
- 预计：1天
- 状态：待开始
- 文件：`admin-web/src/api.ts`（2113 行）
- 问题：0 处 try-catch，拦截器只处理了 401，403/404/500 全部静默失败
- 修复：参考 store-terminal 的 api.ts（41 个 catch 块），补全错误处理

#### R3-13 剩余 15 个表单无输入校验
- 优先级：P1
- 负责人：墨
- 预计：1.5天
- 状态：待开始
- 文件：AftersaleView, CommissionRules, PurchaseOrders, ApprovalRules, SystemConfigView, InventoryBatch, SalesOrderCreate, MyApprovals, TagGroups, PlatformPanel, OrderRoutingView, CollectionLinks, OrderTimeoutView, SaleReturnsView, InventoryBatchPrice, CommissionRecords, OrderProductMapView, MarketingMaterial, CustomerProfile, MarketingView, CreditView, PurchaseInStocks, InventoryAlertConfig, PurchasePlans, ProductImport, SupplierStatements, MarketingPointsMall, CustomerPrices
- 问题：28 个表单无输入校验，13 个已修复，剩余 15 个
- 修复：添加 Element Plus 表单验证规则

#### R3-14 InstantRetailPlatform.vue 硬编码假密钥
- 优先级：P1
- 负责人：墨
- 预计：0.5天
- 状态：待开始
- 文件：`admin-web/src/views/InstantRetailPlatform.vue` L34/48/65/79/108
- 问题：5 处假密钥如 "jd_app_secret_xxxxxx"
- 修复：改为空字符串，由后端 API 返回真实配置

#### R3-15 echarts 图表 innerHTML 清理
- 优先级：P2
- 负责人：墨
- 预计：0.5天
- 状态：待开始
- 文件：ReportsProducts.vue, ReportsEmployees.vue, ReportsStores.vue, FinanceProfit.vue
- 问题：使用 innerHTML 清理图表容器
- 修复：改用 while (el.firstChild) el.removeChild(el.firstChild)

---

### 阿澈 · 前端任务

#### R3-16 npm 安全漏洞修复
- 优先级：P1
- 负责人：阿澈
- 预计：0.5天
- 状态：待开始
- 文件：admin-web/package.json, merchant-mobile/package.json, saas-admin/package.json, store-terminal/package.json
- 问题：vite <=6.4.2（CWE-22 路径遍历）、esbuild <=0.24.2（CWE-346）
- 修复：升级 vite 到 6.4.3+、esbuild 到 0.25+

---

## 汇总

| 负责人 | P0 | P1 | P2 | 总预计 |
|:---:|:---:|:---:|:---:|:---:|
| 阿坚 | 2 | 3 | 2 | 5.5 天 |
| 墨 | 3 | 4 | 1 | 6.5 天 |
| 阿澈 | 0 | 1 | 0 | 0.5 天 |
| **合计** | **5** | **8** | **3** | **12.5 天** |