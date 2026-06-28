# 阿坚 · Phase 1 模块化开发任务

**日期**：2026-06-28
**分支**：main（48ef6c6）
**状态**：⚠️ 6/8 完成，2项待办

---

## ✅ 已完成

- OAuth token 刷新（`http-client.ts`）
- 信用评分引擎（`credit-scoring.service.ts` 4维度评分+阶梯额度）
- evaluate 路由（`POST /credits/:customerId/evaluate`）
- Redis 缓存（`redis-cache.ts`）
- 索引迁移（`add_performance_indexes.sql`）
- 批量更新（`POST /products/batch-update`）

---

## ❌ 待办

### 1. 即时零售 mock 去除

**问题**：`http-client.ts` L8 仍为 `env.INSTANT_RETAIL_MOCK === "true" || !env.INSTANT_RETAIL_MOCK`，空值时默认走 mock。

**要求**：改为仅当 `INSTANT_RETAIL_MOCK=true` 时走 mock，其余走真实 API。

---

### 2. risk-list 路由

**问题**：现有 `/risk-customers`，仍缺 `/risk-list`。

**要求**：新增 `GET /api/admin/credits/risk-list`。

---

**2项待办。**