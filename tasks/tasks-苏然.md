# 苏然 · 数据报表模块 · 测试与DAO层

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 报表汇总表DAO | P0 | ❌ |
| 2 | 报表API集成测试 | P0 | ❌ |
| 3 | 在线收款分析测试 | P0 | ❌ |
| 4 | 报表汇总定时任务测试 | P0 | ❌ |
| 5 | 报表导出功能测试 | P0 | ❌ |
| 6 | 前端报表页面测试 | P0 | ❌ |

---

## 详细说明

### 1. 报表汇总表DAO
- **DAO 文件**：
  - `backend/src/daos/report-sales-daily.dao.ts` — report_sales_daily 表数据访问层
  - `backend/src/daos/report-collection-stats.dao.ts` — report_collection_stats 表数据访问层
  - `backend/src/daos/report-product-sales.dao.ts` — report_product_sales 表数据访问层
  - `backend/src/daos/report-customer-stats.dao.ts` — report_customer_stats 表数据访问层
  - `backend/src/daos/report-inventory-daily.dao.ts` — report_inventory_daily 表数据访问层
- **DAO 方法**（每个DAO通用）：
  - `insertBatch(records)` — 批量插入汇总数据
  - `upsertBatch(records)` — 批量插入或更新（ON DUPLICATE KEY UPDATE）
  - `queryByDateRange(tenantId, startDate, endDate, storeId?)` — 按日期范围查询
  - `queryByDate(tenantId, date, storeId?)` — 按单日查询
  - `getLatestDate(tenantId, storeId?)` — 获取最新汇总日期
  - `deleteByDate(tenantId, date)` — 删除指定日期数据（用于重跑）
- **report_sales_daily 特有方法**：
  - `aggregateFromOrders(tenantId, date)` — 从 orders 表聚合生成销售日报
  - `getSalesTrend(tenantId, startDate, endDate, storeId?)` — 销售趋势查询
  - `getStoreRanking(tenantId, date, storeId?)` — 门店排行查询
- **report_collection_stats 特有方法**：
  - `aggregateFromPayments(tenantId, date)` — 从 payments 表聚合生成收款统计
  - `getChannelDistribution(tenantId, startDate, endDate, storeId?)` — 渠道分布查询
  - `getFunnelData(tenantId, startDate, endDate, storeId?)` — 漏斗数据查询
- **report_product_sales 特有方法**：
  - `aggregateFromOrderItems(tenantId, date)` — 从 order_items 表聚合
  - `getTopProducts(tenantId, date, limit, sortBy)` — 商品排行
  - `getSlowMoving(tenantId, date, threshold)` — 滞销品查询
  - `getABCAnalysis(tenantId, date)` — ABC分析
- **report_customer_stats 特有方法**：
  - `aggregateFromOrders(tenantId, date)` — 从 orders 表聚合
  - `getRFMData(tenantId, date)` — RFM分析数据
  - `getLostCustomers(tenantId, date, daysThreshold)` — 流失客户
- **report_inventory_daily 特有方法**：
  - `aggregateFromInventoryLogs(tenantId, date)` — 从 inventory_logs 表聚合
  - `getAgingDistribution(tenantId, date)` — 库龄分布
  - `getTurnoverTrend(tenantId, startDate, endDate)` — 周转天数趋势

### 2. 报表API集成测试
- **测试文件**：`backend/src/__tests__/report-api.integration.test.ts`
- **测试范围**：验证所有42个报表API端点，确保路由统一后功能正常
- **测试用例**：
  - **经营总览（8个端点）**：概览数据、销售趋势、时段分布、门店排行、品类占比、支付方式分布、最近订单、环比计算
  - **销售分析（7个端点）**：销售趋势（日/周/月粒度）、时段热力图、商品排行、客户排行、门店排行、业务员排行、同期对比
  - **商品分析（5个端点）**：商品概览、畅销排行、滞销预警、毛利排行、ABC分析
  - **客户分析（6个端点）**：客户概览、贡献排行、复购率、客单价分布、RFM分析、流失客户
  - **库存分析（5个端点）**：库存概览、周转趋势、库龄分布、呆滞品预警、出入库趋势
  - **采购分析（3个端点）**：采购概览、供应商排行、采购趋势
  - **财务分析（5个端点）**：财务概览、利润趋势、收入结构、支出结构、现金流趋势
  - **员工绩效（3个端点）**：员工概览、业绩排行、业绩趋势
  - **验证点**：HTTP状态码200、响应JSON结构、分页参数、日期格式、商户隔离（tenant_id）、门店筛选、数据准确性

### 3. 在线收款分析测试
- **测试文件**：`backend/src/__tests__/collection-analysis.test.ts`
- **测试用例**：
  - **收款漏斗数据准确性**：构造测试数据（分享10笔→查看8笔→支付6笔→成功5笔），验证各环节数量和转化率计算正确（80%→75%→83.3%）
  - **渠道转化率**：多渠道数据（微信/支付宝/银行卡），验证各渠道统计独立、转化率计算正确、合计一致
  - **超时分析**：构造不同超时时长的订单，验证超时区间分段统计正确（<30min/30-60min/1-2h/2-24h/24h+）
  - **边界条件**：零数据（新商户无收款记录）、单条数据、大量数据（10000+条）、跨天数据
  - **退款场景**：含退款订单的收款统计，验证退款金额正确扣除
  - **日期范围**：跨月/跨年查询，验证数据边界
  - **商户隔离**：多商户数据，验证只返回当前商户数据

### 4. 报表汇总定时任务测试
- **测试文件**：`backend/src/__tests__/report-summary-job.test.ts`
- **测试用例**：
  - **汇总功能**：执行定时任务，验证5张汇总表数据正确生成（与原始业务表数据对比）
  - **汇总准确性**：
    - report_sales_daily：对比 orders 表聚合销售额/订单数/毛利
    - report_collection_stats：对比 payments 表聚合收款数据
    - report_product_sales：对比 order_items 表聚合商品销售
    - report_customer_stats：对比 orders 表聚合客户数据
    - report_inventory_daily：对比 inventory_logs 表计算库存变动
  - **幂等性**：重复执行同一日期的汇总任务，验证数据不重复、不翻倍
  - **异常处理**：业务表无数据时汇总表为空记录、部分数据缺失时只汇总有效数据
  - **定时调度**：验证 cron 表达式正确（每日凌晨2:00），手动触发立即执行
  - **执行日志**：验证每次执行后记录日志（执行时间/耗时/数据量/状态）
  - **历史数据回填**：指定日期范围回填历史汇总数据，验证逐日执行正确

### 5. 报表导出功能测试
- **测试文件**：`backend/src/__tests__/report-export.test.ts`
- **测试用例**：
  - **Excel导出**：
    - 导出经营总览报表，验证Excel文件生成、表头正确、数据完整、样式（表头加粗/背景色/自动列宽）
    - 各报表类型（sales/collection/product/customer/inventory/purchase/finance/staff/dashboard）逐一导出验证
    - 自定义列导出：选择部分列导出，验证只导出选中列
    - 带筛选条件导出：设置日期范围/门店/品类筛选后导出，验证数据符合筛选条件
    - 合计行：验证Excel底部合计行数据正确
  - **CSV导出**：
    - 验证CSV UTF-8 BOM编码（Excel打开中文不乱码）
    - 验证逗号分隔、引号包裹含特殊字符字段
  - **大文件异步导出**：
    - 构造超过10000条数据，验证走异步导出流程
    - 验证返回任务ID，轮询获取下载链接
    - 验证下载链接有效期和文件完整性
  - **边界条件**：空数据导出（表头+空行或无数据提示）、单条数据导出
  - **并发导出**：多用户同时导出不同报表，验证互不影响

### 6. 前端报表页面测试
- **测试文件**：`backend/src/__tests__/report-frontend-data.test.ts`
- **测试用例**：
  - **经营总览页面**：
    - 概览卡片数据：验证销售额/订单数/毛利/客单价数值与后端一致
    - 环比计算：验证环比增长率和箭头方向正确
    - 迷你趋势图数据：验证近30日趋势数据点数量正确
  - **销售分析页面**：
    - 时段热力图数据：验证24小时×30天数据矩阵完整
    - 排行数据：验证TOP20商品/客户/门店/业务员排序正确
    - 同期对比：验证本期vs上期数据对比正确
  - **商品分析页面**：
    - 滞销预警：验证预警等级（红/橙/黄）判定逻辑正确
    - ABC分析：验证A/B/C分类边界（70%/90%）正确
  - **客户分析页面**：
    - RFM分群：验证R/F/M评分计算逻辑和8群分类正确
    - 复购率：验证复购率=复购客户数/总客户数计算正确
  - **库存分析页面**：
    - 周转天数：验证计算公式（平均库存/日均出库量）正确
    - 库龄分布：验证分段统计正确
  - **图表数据一致性**：同一报表页面中图表数据与表格数据一致
  - **时间筛选一致性**：切换日期范围后所有图表/表格同步更新