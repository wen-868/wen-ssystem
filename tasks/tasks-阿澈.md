# 阿澈 · 采购管理模块 · 商户移动端

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 供应商管理页面 | P1 | ❌ |
| 2 | 供应商对账页面 | P0 | ❌ |

---

## 详细说明

### 1. 供应商管理页面
- **文件**：新建 `merchant-mobile/src/views/SuppliersView.vue` + `merchant-mobile/src/views/SupplierDetailView.vue`
- **功能**：
  - **SuppliersView.vue**：
    - 搜索框 + 分类筛选（酒厂/经销商/其他）
    - 供应商列表卡片（名称/分类/信用等级/联系电话）
    - 点击进入详情
  - **SupplierDetailView.vue**：
    - 基本信息卡片（名称/简称/分类/地址/结算方式/税率/银行账户）
    - 联系人列表（姓名/电话/职位），可拨打电话
    - 采购历史摘要（订单数/总额）
    - 供应产品列表（SKU名称/规格）
- **API**：`fetchSuppliers`、`fetchSupplierDetail`、`fetchSupplierProducts`
- **路由**：`/suppliers`、`/suppliers/:id`

### 2. 供应商对账页面
- **文件**：新建 `merchant-mobile/src/views/SupplierStatementsView.vue` + `merchant-mobile/src/views/SupplierStatementDetailView.vue`
- **功能**：
  - **SupplierStatementsView.vue**：
    - 对账单列表（供应商/期间/金额/状态）
    - 状态筛选（GENERATED/CONFIRMED/DISPUTED）
    - 生成对账单按钮（选择供应商+日期范围）
  - **SupplierStatementDetailView.vue**：
    - 汇总卡片（采购总额/已付/退货/应付余额）
    - 明细列表
    - 确认对账/标记争议按钮
- **API**：`fetchSupplierStatements`、`generateSupplierStatement`、`getSupplierStatementDetail`、`confirmSupplierStatement`、`disputeSupplierStatement`
- **路由**：`/supplier-statements`、`/supplier-statements/:statementNo`