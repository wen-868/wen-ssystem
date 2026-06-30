# 阿澈 · 库存管理模块 · 商户移动端

**日期**：2026-06-30
**状态**：已完成

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 盘点页面 | P0 | ✅ |
| 2 | 调拨页面 | P0 | ✅ |

---

## 详细说明

### 1. 盘点页面
- **文件**：新建 `merchant-mobile/src/views/InventoryCheckView.vue` + `merchant-mobile/src/views/InventoryCheckExecuteView.vue`
- **功能**：
  - **InventoryCheckView.vue**：
    - 盘点单列表（盘点编号/仓库/状态/盘点SKU数/创建时间）
    - 状态筛选：待盘点/已盘点/已审核
    - 新建盘点单按钮（选择仓库→生成盘点单）
  - **InventoryCheckExecuteView.vue**：
    - 盘点SKU列表（商品名称/账面数量/实际数量输入框/差异）
    - 扫码输入（点击扫码按钮调起摄像头扫描条码）
    - 手动输入实际数量
    - 差异自动计算（红色标记）
    - 提交盘点（二次确认）
- **API**：`fetchInventoryChecks`、`createInventoryCheck`、`getInventoryCheckDetail`、`submitInventoryCheck`
- **路由**：`/inventory-checks`、`/inventory-checks/:checkNo/execute`

### 2. 调拨页面
- **文件**：新建 `merchant-mobile/src/views/InventoryTransferView.vue` + `merchant-mobile/src/views/InventoryTransferDetailView.vue`
- **功能**：
  - **InventoryTransferView.vue**：
    - 调拨单列表（调拨编号/调出仓库/调入仓库/状态/金额/创建时间）
    - 状态筛选：待发货/已发货/已收货
    - 新建调拨单按钮（选择调出仓库+调入仓库+商品）
  - **InventoryTransferDetailView.vue**：
    - 调拨单详情：调出/调入仓库信息、商品明细、状态标签
    - 出库确认：调出方点击确认出库（减少调出仓库存）
    - 入库确认：调入方点击确认入库（增加调入仓库存）
    - 状态流转：待发货→已发货→已收货
- **API**：`fetchTransferOrders`、`createTransferOrder`、`getTransferOrderDetail`、`confirmTransferOut`、`confirmTransferIn`
- **路由**：`/inventory-transfers`、`/inventory-transfers/:transferNo`