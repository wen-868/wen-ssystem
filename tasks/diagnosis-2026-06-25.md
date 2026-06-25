# 诊断报告 - 管理后台菜单与路由修复

> **日期：** 2026-06-25
> **检查人：** 凌舟
> **修复范围：** admin-web 导航菜单、路由配置、销售开单功能

---

## 一、发现的问题

| # | 问题 | 严重程度 | 影响范围 |
|---|------|---------|---------|
| 1 | 一级分类只有 11 个，缺少"订单管理" | 高 | 产品规划 V3.0 要求 12 个一级分类 |
| 2 | 门店管理独立为一级菜单，应在系统管理下 | 中 | 导航结构不符合产品规划 |
| 3 | 二级菜单基本缺失（采购退货、采购付款、库存盘点、库存调拨、批次追溯、商品分类、收款链接、经营利润、报表子项、促销活动、角色权限等） | 高 | 用户无法访问这些功能模块 |
| 4 | 管理后台不能开销售单，提示"去收银台" | 严重 | 核心业务流程断裂 |
| 5 | 收银台区域显示占位文本"功能迁移中"而非实际功能 | 高 | 收银台不可用 |

---

## 二、修复内容

### 2.1 菜单结构重写（MainLayout.vue）

**修复前：** 11 个一级分类，二级菜单不完整
**修复后：** 12 个一级分类，所有二级菜单按产品规划 V3.0 补全

| 一级分类 | 修复前二级菜单数 | 修复后二级菜单数 | 新增菜单项 |
|---------|:---:|:---:|------|
| 工作台 | 1 | 1 | - |
| 销售管理 | 3 | 4 | 销售开单 |
| 订单管理 | 0 | 3 | 订单列表、泳道看板、超时处理 |
| 采购管理 | 3 | 5 | 采购退货、采购付款 |
| 库存管理 | 2 | 5 | 库存盘点、库存调拨、批次追溯 |
| 客户管理 | 2 | 2 | - |
| 商品中心 | 2 | 3 | 商品分类 |
| 即时零售 | 2 | 5 | 商城配置、客户下单、在线支付、配送管理、零售报表 |
| 财务管理 | 3 | 4 | 经营利润 |
| 数据报表 | 1 | 4 | 商品排行、员工业绩、门店对比 |
| 营销推广 | 2 | 3 | 促销活动 |
| 系统管理 | 3 | 5 | 角色权限、门店管理（从独立移入） |

### 2.2 销售开单页面（新建 SalesOrderCreate.vue）

- 完整的销售开单表单：客户搜索、销售类型（现结/赊销）、配送方式、商品明细表
- 右侧金额汇总：合计金额、整单折扣、抹零金额、应收金额
- 支持保存草稿和提交订单
- 修复了 API 引用（`adminApi` → `api`）

### 2.3 收银台逻辑修复（MainLayout.vue）

- 修复前：收银台区域显示"收银台功能迁移中..."占位文本
- 修复后：`<router-view v-if="isCashierMode" />` 正确渲染收银台路由

### 2.4 路由扩展（router/index.ts）

- 修复前：25 条路由
- 修复后：41 条路由（含 14 条新增）

### 2.5 新建占位视图（13 个）

| 视图文件 | 对应路由 | 所属模块 |
|---------|---------|---------|
| PurchaseReturns.vue | /purchase-returns | 采购管理 |
| PurchasePayments.vue | /purchase-payments | 采购管理 |
| InventoryCheck.vue | /inventory-check | 库存管理 |
| InventoryTransfer.vue | /inventory-transfer | 库存管理 |
| InventoryBatch.vue | /inventory-batch | 库存管理 |
| ProductCategories.vue | /products/categories | 商品中心 |
| FinanceCollection.vue | /finance/collection | 财务管理 |
| FinanceProfit.vue | /finance/profit | 财务管理 |
| ReportsProducts.vue | /reports/products | 数据报表 |
| ReportsEmployees.vue | /reports/employees | 数据报表 |
| ReportsStores.vue | /reports/stores | 数据报表 |
| MarketingPromotion.vue | /marketing/promotion | 营销推广 |
| SystemRoles.vue | /system/roles | 系统管理 |

> 以上视图均为占位页面（显示"功能开发中"），待后续分配功能开发。

---

## 三、构建验证

```
✓ built in 6.87s
```

admin-web 构建成功，41 条路由均可正常导航。

---

## 四、待办事项

| 优先级 | 任务 | 负责人 | 预计工时 |
|-------|------|-------|:---:|
| P0 | 13 个占位视图逐步实现功能开发 | 墨/阿澈 | 按模块分配 |
| P1 | 即时零售 5 个页面（当前 disabled） | 阿澈 | 5天 |
| P1 | 字段更新：9 个模块的视图按 form-field-spec-v1.md 更新 | 墨/阿澈 | ~16天 |
| P2 | 后台 API 适配新路由（如 /sales/create 后端） | 阿坚 | 3天 |

---

## 五、变更文件清单

```
修改：
  admin-web/src/layouts/MainLayout.vue    - 菜单重构 + 收银台修复
  admin-web/src/router/index.ts          - 路由从 25 条扩展到 41 条

新建：
  admin-web/src/views/SalesOrderCreate.vue  - 销售开单页面
  admin-web/src/views/PurchaseReturns.vue   - 采购退货（占位）
  admin-web/src/views/PurchasePayments.vue  - 采购付款（占位）
  admin-web/src/views/InventoryCheck.vue    - 库存盘点（占位）
  admin-web/src/views/InventoryTransfer.vue - 库存调拨（占位）
  admin-web/src/views/InventoryBatch.vue    - 批次追溯（占位）
  admin-web/src/views/ProductCategories.vue - 商品分类（占位）
  admin-web/src/views/FinanceCollection.vue - 收款链接（占位）
  admin-web/src/views/FinanceProfit.vue     - 经营利润（占位）
  admin-web/src/views/ReportsProducts.vue   - 商品排行（占位）
  admin-web/src/views/ReportsEmployees.vue  - 员工业绩（占位）
  admin-web/src/views/ReportsStores.vue     - 门店对比（占位）
  admin-web/src/views/MarketingPromotion.vue - 促销活动（占位）
  admin-web/src/views/SystemRoles.vue      - 角色权限（占位）
```