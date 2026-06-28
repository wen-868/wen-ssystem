# 阿坚 · 模块化开发任务

**日期**：2026-06-28
**分支**：main（c3ff2de）
**阶段**：模块化开发 — Phase 1

---

## 模块1：即时零售真实对接 · 5天

当前 `instant-retail/adapters/` 下 meituan/elem/jd 三个适配器均为 mock 实现，需替换为真实 API。

**要求**：
- 美团 adapter：替换 mock 为真实 API 签名、订单同步、商品同步、库存同步
- 饿了么 adapter：同上
- 京东 adapter：同上
- 实现 OAuth 令牌刷新机制
- 实现错误重试和降级策略
- 保留 mock 模式开关（`INSTANT_RETAIL_MOCK=true` 环境变量）

**参考**：当前 `meituan-adapter.ts` 已有签名逻辑骨架，补充完整即可。

---

## 模块2：赊销风控引擎 · 4天

当前赊销管理有基础 CRUD 和超期扫描，但缺少风控决策能力。

**要求**：
- 信用评分模型：基于客户历史回款率、逾期次数、交易频次、交易金额计算信用分
- 自动授信：新客户默认额度 + 阶梯式提额规则
- 赊销拦截：开单时校验客户信用额度，超限自动拦截
- 催收策略：按逾期天数分级（1-30天/31-60天/60+天），自动生成催收任务
- API 端点：`POST /api/admin/credits/evaluate`、`GET /api/admin/credits/risk-list`

**依赖**：`credit.routes.ts` 已有基础，新增 `credit-engine.service.ts`。

---

## 模块3：API 性能优化 · 3天

**要求**：
- 慢查询分析：检查 `backend/src/services/` 下所有 SQL 查询，为高频查询添加索引
- 数据库索引：products（sku_code, barcode, tenant_id）、sale_bills（bill_no, created_at, tenant_id）、inventory（sku_id, tenant_id, store_id）
- Redis 缓存：dashboard 统计数据、商品列表、价格阶梯缓存，TTL 5分钟
- 批量接口：`POST /api/admin/products/batch-update` 批量更新商品价格/状态

**交付物**：`docs/migrations/add_indexes.sql` + 缓存中间件。

---

## 汇总

| 模块 | 内容 | 工期 |
|------|------|------|
| 即时零售真实对接 | 3个平台适配器 | 5天 |
| 赊销风控引擎 | 信用评分+拦截+催收 | 4天 |
| API 性能优化 | 索引+缓存+批量 | 3天 |

**总计：12天。**