# 阿坚 · 库存管理模块 · 后端

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | DDL修复：stock_check/transfer_order 表 + tenant_id 补全 | P0 | ❌ |
| 2 | 库存成本核算（移动加权平均） | P0 | ❌ |
| 3 | 库存预警配置化（阈值表+动态查询） | P0 | ❌ |
| 4 | 库存报表 API（周转率/库龄/ABC） | P1 | ❌ |
| 5 | 损益处理 API | P2 | ❌ |

---

## 详细说明

### 1. DDL修复：补全缺失表 + tenant_id
- **现状**：`stock_check`/`stock_check_item`/`transfer_order`/`transfer_order_item` 四张表无 DDL，代码大量引用但 init_database.sql 中无 CREATE TABLE；`inventory_balance`/`inventory_batch`/`inventory_ledger` 三张核心表缺 `tenant_id` 列
- **需要**：
  - DDL：`stock_check` 表（check_no, store_id, check_status, total_sku, checked_sku, profit_qty, loss_qty, operator_id, auditor_id, audited_at, tenant_id）+ `stock_check_item` 表（check_no, sku_id, book_qty, actual_qty, diff_qty, diff_reason, cost_price, tenant_id）
  - DDL：`transfer_order` 表（transfer_no, from_store_id, to_store_id, transfer_status, goods_amount, operator_id, tenant_id）+ `transfer_order_item` 表（transfer_no, sku_id, box_qty, bottle_qty, total_bottle_qty, unit_price, tenant_id）
  - DDL：`stock_warning_config` 表（store_id, sku_id, min_qty, max_qty, enabled, tenant_id）
  - ALTER TABLE：`inventory_balance`/`inventory_batch`/`inventory_ledger` 补 `tenant_id VARCHAR(64) DEFAULT ''`
- **文件**：`docs/migrations/add_stock_check_tables.sql`、`docs/migrations/add_transfer_order_tables.sql`、`docs/migrations/add_stock_warning_config.sql`、`docs/migrations/add_tenant_id_to_inventory.sql`

### 2. 库存成本核算（移动加权平均）
- **现状**：`inventory_batch.cost_price` 字段存在，但无核算逻辑
- **需要**：
  - 入库时更新移动加权平均成本：`(现有库存*现有成本 + 入库数量*入库单价) / (现有库存 + 入库数量)`
  - 写入 `product_sku.cost_price` 字段
  - `GET /api/admin/inventory/cost-detail` — 成本明细（SKU维度：期初/本期入库/本期出库/期末）
  - `GET /api/admin/inventory/cost-trend` — 成本变动趋势
- **文件**：`backend/src/services/admin/inventory-cost.service.ts`、`backend/src/routes/inventory-cost.routes.ts`

### 3. 库存预警配置化
- **现状**：低库存预警硬编码 `available_qty <= 5`
- **需要**：
  - 基于 `stock_warning_config` 表的动态阈值
  - `GET /api/admin/stock-warnings` — 预警列表（按 min_qty/max_qty 配置过滤）
  - `POST /api/admin/stock-warnings/config` — 批量配置预警阈值
  - 效期预警已有 `expiry_alert_config` 表，保持现状
- **文件**：`backend/src/services/admin/stock-warning.service.ts`、`backend/src/routes/stock-warning.routes.ts`

### 4. 库存报表 API
- **现状**：无
- **需要**：
  - `GET /api/admin/reports/inventory-turnover` — 库存周转率（按 SKU/品类，出库量/平均库存）
  - `GET /api/admin/reports/inventory-age` — 库龄分析（按入库时间分段：<30天/30-60天/60-90天/>90天）
  - `GET /api/admin/reports/inventory-abc` — ABC 分类（A类：占销售额70%/B类：20%/C类：10%）
- **文件**：在 `backend/src/services/admin/report.service.ts` 和 `backend/src/controllers/admin/report.controller.ts` 中追加方法

### 5. 损益处理 API
- **现状**：无
- **需要**：
  - DDL：`inventory_loss_gain` 表（lg_no, store_id, type[LOSS/GAIN], sku_id, qty, cost_price, amount, reason, operator_id, status, tenant_id）
  - `POST /api/admin/inventory/report-loss-gain` — 报损/报溢
  - `GET /api/admin/inventory/loss-gains` — 损益列表
  - 报损/报溢时更新 `inventory_balance` 并写入 `inventory_ledger`
- **文件**：`docs/migrations/add_inventory_loss_gain.sql`、`backend/src/services/admin/inventory-loss-gain.service.ts`、`backend/src/routes/inventory-loss-gain.routes.ts`