# 墨 · 任务清单（技术负责人 · V4.5 审计整改版）

> **更新日期：** 2026-06-27
> **当前阶段：** V4.5 · 审计问题整改
> **进展：** saas-admin 5 个 P0 模块已完成，admin-web 50 个视图 42 个已完整实现
> **核心理念：** PC端只有一端，管理后台和收银台按权限切换

---

## 当前策略

⚠️ 2026-06-27 凌舟全系统审计发现：
- 硬编码凭证：`admin-web/src/App.vue` 登录表单默认填 `admin/admin123`（**严重**）
- 路由缺失：`InventoryBatchPrice.vue` 和 `InventoryPriceQuote.vue` 文件存在但 router 未注册
- 角色权限：admin-web 14 条路由无角色限制，saas-admin 无角色检查
- 即时零售：8 个视图仍是占位（`<el-empty>`）

---

## P0：立即修复（1.5天）

| 编号 | 任务 | 工时 | 状态 | 验收标准 |
|------|------|:---:|:---:|------|
| **P0-01** | **App.vue 移除硬编码凭证** | 0.5天 | 🔴 | 移除 `loginForm` 中 `admin/admin123` 默认值，改为 `{ username: "", password: "" }`；移除 `placeholder="admin123"` |
| **P0-02** | **补注册 2 条缺失路由** | 0.5天 | 🔴 | `InventoryBatchPrice.vue` → `/inventory-batch-price`；`InventoryPriceQuote.vue` → `/inventory-price-quote`；路由注册到 `router/index.ts` |
| **P0-03** | **admin-web 路由角色权限加固** | 0.5天 | 🔴 | 14 条无限制路由加 `meta.roles`：销售开单/订单管理/库存查询/客户管理/商品管理等限 BOSS+MGR |

---

## P1：平台总后台收尾（3天）

| 编号 | 任务 | 工时 | 状态 | 验收标准 |
|------|------|:---:|:---:|------|
| **PLAT-07** | **saas-admin 路由角色权限** | 0.5天 | 🔴 | 添加 `meta.roles` 限制，仅 `SUPER_ADMIN` 可访问租户/套餐/订阅管理 |
| **PLAT-08** | **saas-admin 操作日志页面** | 1.5天 | 🔴 | 对接 `/api/platform/audit-logs`，列表/搜索/筛选 |
| **PLAT-09** | **saas-admin 全局细节打磨** | 1天 | 🔴 | 表单校验、错误提示、loading 状态、空数据展示 |

---

## G1：即时零售 8 个视图补齐（22天）

| 编号 | 任务 | 工时 | 状态 | 验收标准 |
|------|------|:---:|:---:|------|
| S10-01 | **InstantRetailConfig** - 小程序店铺配置页 | 2.5天 | ⏳ | 店铺信息/首页装修/导航配置/公告管理 |
| S10-02 | **InstantRetailShelf** - 商品货架管理页 | 3天 | ⏳ | 分类展示/搜索/价格分层（零售价+批发价） |
| S10-03 | **InstantRetailOrders** - 小程序订单管理页 | 2天 | ⏳ | 订单列表/状态追踪/物流查询 |
| S10-04 | **InstantRetailPayment** - 在线支付配置页 | 2天 | ⏳ | 微信商户号配置/支付记录/退款管理 |
| S10-05 | **InstantRetailDelivery** - 配送管理页 | 2天 | ⏳ | 配送方式/运费模板/自提点管理 |
| S10-06 | **InstantRetailReport** - 零售报表页 | 2天 | ⏳ | 销售数据/毛利分析展示 |
| S10-07 | **InstantRetailPlatform** - 外卖平台对接页 | 3天 | ⏳ | 平台密钥配置/商品上架同步 |
| S10-08 | **InstantRetailOrderBoard** - 60秒接单工作台 | 3天 | ⏳ | 强制倒计时接单，超时自动拒 |

---

## 已有视图细节打磨（穿插）

> 以下 42 个视图已完整实现，穿插打磨细节：
>
> - 工作总台：Dashboard
> - 销售管理：SalesOrderCreate, SaleBills, SaleReturns, Collection（4个）
> - 订单管理：Orders, OrderBoard, OrderTimeout（3个）
> - 采购管理：PurchaseOrders, PurchaseInStocks, PurchaseReturns, PurchasePayments, Suppliers（5个）
> - 库存管理：Inventory, InventoryCheck, InventoryTransfer, InventoryBatch, InventoryAlerts, InventoryBatchPrice, InventoryPriceQuote（7个）
> - 客户管理：Customers, Credit（2个）
> - 商品中心：Products, ProductCategories, Prices（3个）
> - 即时零售：10个（8个占位 + 2个待注册）
> - 财务往来：Payments, FinanceCollection, CustomerStatements, FinanceProfit（4个）
> - 数据报表：Reports, ReportsProducts, ReportsEmployees, ReportsStores（4个）
> - 营销中心：Marketing, MarketingPromotion, Aftersale（3个）
> - 系统设置：Employees, Stores, SystemRoles, AuditLog, System（5个）

**打磨内容：** 字段对齐产品规格、表单校验规则完善、交互体验优化、API对接正确性验证

---

## 工期汇总

| 阶段 | 内容 | 工时 | 状态 |
|------|------|:---:|:---:|
| P0 | 硬编码凭证 + 缺失路由 + 角色加固 | 1.5天 | 🔴 |
| P1 | saas-admin 收尾 | 3天 | 🔴 |
| G1 | 即时零售 8 个视图 | 22天 | ⏳ |
| **合计** | | **26.5天** | |