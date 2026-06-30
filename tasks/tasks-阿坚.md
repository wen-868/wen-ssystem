# 阿坚 · 数据报表模块 · 后端

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 统一报表路由 | P0 | ❌ |
| 2 | 在线收款专项分析API | P0 | ❌ |
| 3 | 客户分析API补充 | P0 | ❌ |
| 4 | 报表导出API | P0 | ❌ |
| 5 | 报表数据汇总DDL | P0 | ❌ |
| 6 | 报表定时任务 | P0 | ❌ |

---

## 详细说明

### 1. 统一报表路由
- **背景**：当前报表相关端点分散在 `admin.routes.ts` 和 `report.routes.ts` 两套路由中，新旧并存，需统一迁移
- **操作**：
  - 排查 `admin.routes.ts` 中所有报表相关端点（约42个），逐一迁移到 `report.routes.ts`
  - 更新路由前缀为 `/api/admin/reports/` 统一入口
  - 删除 `admin.routes.ts` 中已迁移的旧端点定义
  - 确保所有前端调用同步更新到新路由
- **文件**：`backend/src/routes/report.routes.ts`、`backend/src/routes/admin.routes.ts`

### 2. 在线收款专项分析API
- **接口**：
  - `GET /api/admin/reports/collection/funnel` — 收款漏斗分析（分享数→查看数→支付数→支付金额，含各环节转化率）
  - `GET /api/admin/reports/collection/channel-conversion` — 渠道转化率（按收款渠道：微信/支付宝/银行卡/现金，统计笔数/金额/占比/转化率）
  - `GET /api/admin/reports/collection/timeout` — 超时未付分析（超时订单数/金额/超时率/平均超时时长，支持按超时区间分段：<30min/30-60min/1-2h/2-24h/24h+）
  - `GET /api/admin/reports/collection/daily-trend` — 收款趋势（按日统计收款笔数/金额/渠道分布）
  - `GET /api/admin/reports/collection/summary` — 收款总览（累计收款/本月收款/今日收款/退款率/平均收款周期）
  - **公共参数**：`tenant_id`（商户隔离）、`start_date`、`end_date`、`store_id`（可选门店筛选）
- **关键字段**：`order_count, share_count, view_count, pay_count, pay_amount, conversion_rate, channel, timeout_count, timeout_amount, timeout_rate, avg_timeout_minutes`
- **文件**：`backend/src/services/admin/report-collection.service.ts`、合并到 `backend/src/routes/report.routes.ts`

### 3. 客户分析API补充
- **接口**：
  - `GET /api/admin/reports/customer/repurchase` — 复购率分析（总体复购率/按月复购率趋势/复购客户数/复购订单占比）
  - `GET /api/admin/reports/customer/avg-order-value` — 客单价分布（按价格区间分段：<100/100-300/300-500/500-1000/1000-3000/3000+，统计各区间客户数/订单数/占比）
  - `GET /api/admin/reports/customer/rfm` — RFM分析（最近消费时间R/消费频率F/消费金额M，按RFM分群：重要价值客户/重要发展客户/重要保持客户/重要挽留客户/一般价值客户/一般发展客户/一般保持客户/一般挽留客户）
  - `GET /api/admin/reports/customer/contribution` — 客户贡献排行（TOP客户按消费金额/订单数/利润贡献排序）
  - `GET /api/admin/reports/customer/new-customer-trend` — 新增客户趋势（按日/周/月统计新增客户数）
  - `GET /api/admin/reports/customer/lost-customer` — 流失客户分析（超过N天未消费客户列表/流失率）
- **关键字段**：`repurchase_rate, customer_id, customer_name, avg_order_value, r_score, f_score, m_score, rfm_group, contribution_amount, new_customer_count, lost_customer_count, lost_rate`
- **文件**：`backend/src/services/admin/report-customer.service.ts`、合并到 `backend/src/routes/report.routes.ts`

### 4. 报表导出API
- **接口**：
  - `POST /api/admin/reports/export` — 统一报表导出入口
  - **请求体**：`{ report_type: 'sales'|'collection'|'product'|'customer'|'inventory'|'purchase'|'finance'|'staff'|'dashboard', format: 'excel'|'csv', filters: {...}, columns: [...] }`
  - 支持自定义选择导出列
  - 支持按当前筛选条件导出
  - Excel格式：含表头样式、自动列宽、合计行
  - CSV格式：UTF-8 BOM编码（兼容Excel中文）
  - 大文件异步导出（超过10000行走异步任务，返回下载链接）
- **文件**：`backend/src/services/admin/report-export.service.ts`、合并到 `backend/src/routes/report.routes.ts`

### 5. 报表数据汇总DDL
- **背景**：报表查询直接关联业务表性能差，需创建汇总表定期预聚合
- **表结构**：
  - **report_sales_daily**：`id, tenant_id, store_id, report_date, total_orders, total_amount, total_cost, gross_profit, gross_margin_rate, avg_order_value, new_customer_count, repurchase_customer_count, payment_count, refund_count, refund_amount, created_at, updated_at`（唯一索引：tenant_id+store_id+report_date）
  - **report_collection_stats**：`id, tenant_id, store_id, report_date, channel, share_count, view_count, pay_count, pay_amount, conversion_rate, timeout_count, timeout_amount, avg_timeout_minutes, created_at, updated_at`（唯一索引：tenant_id+store_id+report_date+channel）
  - **report_product_sales**：`id, tenant_id, store_id, report_date, product_id, product_name, category_id, category_name, sales_quantity, sales_amount, sales_cost, gross_profit, gross_margin_rate, rank_by_amount, rank_by_quantity, created_at, updated_at`（唯一索引：tenant_id+store_id+report_date+product_id）
  - **report_customer_stats**：`id, tenant_id, store_id, report_date, customer_id, customer_name, order_count, order_amount, avg_order_value, last_order_date, repurchase_count, is_new, created_at, updated_at`
  - **report_inventory_daily**：`id, tenant_id, store_id, report_date, product_id, product_name, beginning_stock, ending_stock, stock_in, stock_out, turnover_days, aging_days, is_slow_moving, created_at, updated_at`
- **文件**：`docs/migrations/add_report_summary.sql`

### 6. 报表定时任务
- **任务**：每日凌晨自动汇总前一天数据到汇总表
- **实现方式**：使用 node-cron 或 bull 队列
- **汇总逻辑**：
  - `report_sales_daily`：从 orders 表聚合每日销售数据（按tenant+store+date）
  - `report_collection_stats`：从 payments 表聚合收款渠道数据
  - `report_product_sales`：从 order_items 表聚合商品维度销售数据
  - `report_customer_stats`：从 orders 表聚合客户维度统计数据
  - `report_inventory_daily`：从 inventory_logs 表计算库存变动
- **幂等性**：使用唯一索引 + ON DUPLICATE KEY UPDATE 保证重复执行安全
- **监控**：汇总完成后记录执行日志（成功/失败/耗时/数据量）
- **文件**：`backend/src/jobs/report-summary.job.ts`、`backend/src/services/admin/report-summary.service.ts`