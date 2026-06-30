# 墨 · 库存管理模块 · 管理后台

**日期**：2026-06-30
**状态**：0/3 未交付（分支做的是 TagGroups/Products/InventoryBatch 增强，属于 Phase 3 商品中心）

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 库存成本核算页面 | P0 | ❌ |
| 2 | 库存预警配置页面 | P0 | ❌ |
| 3 | 库存报表页面 | P1 | ❌ |

---

## 详细说明

### 1. 库存成本核算页面
- **文件**：新建 `admin-web/src/views/InventoryCost.vue`
- **功能**：
  - 成本明细表：SKU名称/期初数量/期初成本/本期入库数量/金额/本期出库数量/金额/期末数量/期末成本/移动平均单价
  - 成本趋势图：ECharts 折线图，展示近30天移动平均成本变动
  - 筛选：品类/日期范围/关键词搜索
  - 汇总卡片：库存总成本/本期入库总成本/本期出库总成本
- **API**：`fetchInventoryCostDetail`、`fetchInventoryCostTrend`
- **路由**：`/inventory/cost`

### 2. 库存预警配置页面
- **文件**：新建 `admin-web/src/views/InventoryAlertConfig.vue`
- **功能**：
  - 预警汇总卡片：低库存SKU数/超库存SKU数/效期预警数，点击跳转列表
  - 预警配置列表：SKU名称/当前库存/最低阈值/最高阈值/低库存/超库存状态标签
  - 批量配置弹窗：选择商品 + 设置最低/最高阈值
  - 已触发预警高亮显示（红色/橙色）
- **API**：`fetchStockWarnings`、`batchConfigStockWarning`、`fetchStockWarningConfigs`
- **路由**：`/inventory/alerts-config`

### 3. 库存报表页面
- **文件**：新建 `admin-web/src/views/InventoryReports.vue`
- **功能**：
  - 库存周转率：表格（SKU/品类/月出库量/平均库存/周转率/周转天数）+ 柱状图
  - 库龄分析：ECharts 饼图（<30天/30-60天/60-90天/>90天）+ 明细表格
  - ABC分类：帕累托图（柱状+折线双轴）+ 三类汇总表
  - 筛选：品类/仓库/日期范围
- **API**：`fetchInventoryTurnover`、`fetchInventoryAge`、`fetchInventoryABC`
- **路由**：`/reports/inventory`