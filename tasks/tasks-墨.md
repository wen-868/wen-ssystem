# 墨 · 采购管理模块 · 管理后台

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 供应商对账页面 | P0 | ❌ |
| 2 | 采购报表页面 | P1 | ❌ |
| 3 | 采购计划页面 | P1 | ❌ |

---

## 详细说明

### 1. 供应商对账页面
- **文件**：新建 `admin-web/src/views/SupplierStatements.vue`
- **功能**：
  - 对账单列表（供应商名称/期间/采购金额/已付金额/退货金额/余额/状态）
  - 生成对账单弹窗：选择供应商 + 日期范围（period_start/period_end）+ 点击生成
  - 对账单详情抽屉：汇总卡片（采购总额/已付总额/退货总额/应付余额）+ 明细列表（采购订单/付款单/退货单，金额逐笔）
  - 确认对账 + 标记争议按钮
  - 状态标签：GENERATED（待确认）/ CONFIRMED（已确认）/ DISPUTED（争议）
- **API**：`fetchSupplierStatements`、`generateSupplierStatement`、`getSupplierStatementDetail`、`confirmSupplierStatement`、`disputeSupplierStatement`
- **路由**：`/purchase/supplier-statements`

### 2. 采购报表页面
- **文件**：新建 `admin-web/src/views/PurchaseReports.vue`
- **功能**：
  - 汇总卡片：本月采购额/订单数/供应商数/入库量
  - 采购趋势：ECharts 折线图（按日/周/月切换）
  - 供应商排名：ECharts 横向柱状图（采购金额降序）
  - 品类采购占比：ECharts 环形饼图
  - 筛选条件：日期范围、供应商、品类
- **API**：`fetchPurchaseSummary`、`fetchPurchaseTrend`、`fetchSupplierRanking`
- **路由**：`/reports/purchase`

### 3. 采购计划页面
- **文件**：新建 `admin-web/src/views/PurchasePlans.vue`
- **功能**：
  - 智能补货建议 Tab：列表（商品/当前库存/安全库存/月均销量/建议采购量/建议原因），支持多选 → 一键生成采购计划
  - 采购计划 Tab：计划列表（计划编号/供应商/商品数/金额/状态/创建时间），点击转采购订单
  - 计划详情：商品明细列表
- **API**：`fetchPurchaseSuggestions`、`createPurchasePlan`、`fetchPurchasePlans`、`convertPurchasePlanToOrder`
- **路由**：`/purchase/plans`