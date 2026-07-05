# 当前任务

> 唯一任务文件，所有团队成员读取此文件获取任务。  
> 凌舟维护，每次分派新增轮次。  
> 最后更新：2026-07-05

---

## 历史轮次

### R1 — 2026-07-05 苏然测试报告 v2 [已完成]

> 来源：苏然第二轮全局深度测试，16 个问题。  
> 阿坚/阿澈已提交部分修复，剩余未完成项转入 R3。

### R2 — 2026-07-05 凌舟后台验收 [已完成]

> 来源：凌舟实际验收后台发现的数据完整性问题。  
> 已分派给墨和阿坚，转入 R3 统一跟踪。

### R3 — 2026-07-05 阿坚后端修复 [已完成]

> 阿坚完成 4 项：brand_id 外键、客户 create API 补字段、API 路径统一、审批 EXPENSE 类型。  
> 剩余未完成项转入 R4。

---

## R4 — 2026-07-05 前端字段完整度修复 [已完成]

> 整合 R1~R3 所有未完成任务，合并为一个任务。  
> 之前各分支（阿坚 V9uC3J、墨 4njSbh、阿澈 tkoXzL、苏然 4ikMYJ、林夕 oqrXJp）的代码已全部合并到 main，无遗漏。

---

### 墨 · 全部剩余任务

#### R4-1 前端字段完整度修复（合并任务）

- 优先级：P0
- 负责人：墨
- 预计：7 天
- 状态：已完成

**包含以下子任务：**

**A. 客户管理（P0，2天）**
- 文件：`admin-web/src/views/CustomersView.vue`（新增弹窗 L64-83）
- 新增表单补 address、remark、settlementType、staffId 共 4 个字段
- 列表补上 address、settlementType、points、levelCode、status、remark 列

**B. 商品信息（P0，2天）**
- 文件：`admin-web/src/views/Products.vue`
- SPU 层补：unit、specs、sortNo、isNew、isRecommend、description、imageUrls（轮播图）、marketingTags
- 价格层补：costPrice（当前硬编码为0）、storePrice
- SKU 层补：volume（净含量）、packaging（包装类型）、baseUnit、boxUnit
- 修复品牌 Bug：创建时发送 brandId
- 列表展示库存 availableQty
- 编辑时一并设置标签

**C. 错误处理（P0，1天）**
- 文件：`admin-web/src/api.ts`（2113 行）
- 0 处 try-catch，拦截器只处理了 401，403/404/500 全部静默失败
- 参考 store-terminal 的 api.ts（41 个 catch 块），补全错误处理

**D. 表单校验（P1，1.5天）**
- 文件：AftersaleView, CommissionRules, PurchaseOrders, ApprovalRules, SystemConfigView, InventoryBatch, SalesOrderCreate, MyApprovals, TagGroups, PlatformPanel, OrderRoutingView, CollectionLinks, OrderTimeoutView, SaleReturnsView, InventoryBatchPrice, CommissionRecords, OrderProductMapView, MarketingMaterial, CustomerProfile, MarketingView, CreditView, PurchaseInStocks, InventoryAlertConfig, PurchasePlans, ProductImport, SupplierStatements, MarketingPointsMall, CustomerPrices
- 28 个表单中 13 个已修复，剩余 15 个添加 Element Plus 表单验证规则

**E. 分类三级（P1，0.5天）**
- 文件：`admin-web/src/views/ProductCategories.vue` L333-337
- allowDrop 中 dropNode.level < 2 → 改为 dropNode.level < 3

**F. 审批类型（P1，0.5天）**
- 文件：`admin-web/src/views/ApprovalRules.vue` L103-109
- 审批规则业务类型补充 EXPENSE 选项

**G. 硬编码密钥（P1，0.5天）**
- 文件：`admin-web/src/views/InstantRetailPlatform.vue` L34/48/65/79/108
- 5 处假密钥如 "jd_app_secret_xxxxxx" 改为空字符串

**H. innerHTML 清理（P2，0.5天）**
- 文件：ReportsProducts.vue, ReportsEmployees.vue, ReportsStores.vue, FinanceProfit.vue
- 改用 while (el.firstChild) el.removeChild(el.firstChild)

**I. 后端清理（P1/P2，3.5天）**
- 文件：43 个 controller（约 130 处 try-catch）+ 各 service 文件（约 300 处 as any）+ `backend/src/routes/admin.routes.ts`
- 移除 controller 中冗余 try-catch，让 asyncHandler 传递错误到 errorHandler
- 替换 as any 为安全类型定义
- 拆分 admin.routes.ts（83 个端点）按业务模块

**J. npm 安全漏洞（P1，0.5天）**
- 文件：admin-web/package.json, merchant-mobile/package.json, saas-admin/package.json, store-terminal/package.json
- 升级 vite 到 6.4.3+、esbuild 到 0.25+

---

## 汇总

| 负责人 | 任务 | 预计 |
|:---:|------|:---:|
| 墨 | R4-1 前端字段完整度修复（含后端清理+安全漏洞） | 7 天 |
| **合计** | **1 个任务** | **7 天** |