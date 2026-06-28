# 阿坚 · Phase 1 模块化开发任务

**日期**：2026-06-28
**分支**：main（9c503f0）
**状态**：⚠️ 4/9 完成，5项待办

---

## ✅ 已完成

| 模块 | 项目 | 证据 |
|------|------|------|
| 即时零售 | OAuth token 刷新 | `http-client.ts` 自动刷新+重试，三个适配器已接入 |
| 赊销风控 | 信用评分引擎 | `credit-scoring.service.ts` 4维度评分+阶梯额度 |
| 赊销风控 | evaluate 路由 | `POST /credits/:customerId/evaluate` |
| 性能优化 | Redis 缓存 | `redis-cache.ts` ioredis 懒加载，TTL 5分钟 |
| 性能优化 | 索引迁移 | `docs/migrations/add_performance_indexes.sql` |
| 性能优化 | 批量更新 | `POST /products/batch-update` + `PUT /sys-config/batch` |

---

## ❌ 待办

### 模块1：即时零售 mock 去除

**问题**：`http-client.ts` L8 逻辑为 `env.INSTANT_RETAIL_MOCK === "true" || !env.INSTANT_RETAIL_MOCK`，空值时默认走 mock。三个 adapter 的 `authenticate()` 仍有 mock 降级。

**要求**：
- 修改判断逻辑：仅当 `INSTANT_RETAIL_MOCK=true` 时走 mock，其余走真实 API
- 删除 adapter 中的 mock 凭证降级（`mock_app_key` 等）
- 验证真实 API 通路

---

### 模块2：赊销风控 — risk-list 路由

**问题**：现有 `/risk-customers`，缺少 `/risk-list` 端点。

**要求**：新增 `GET /api/admin/credits/risk-list`，返回风险客户列表（信用分低于阈值、逾期超过30天、额度使用率超过80%）。

---

## 汇总

| 模块 | 完成项 | 待办项 |
|------|--------|--------|
| 即时零售 | OAuth ✅ | mock去除 ❌ |
| 赊销风控 | 评分引擎 ✅、evaluate ✅ | risk-list路由 ❌ |
| 性能优化 | Redis ✅、索引 ✅、批量 ✅ | — |

**6/8 完成。2项待办。**