# 项目记忆文件

> 最后更新：2026-07-03
> 当前分支：main（已合并 trae/solo-agent-4ikMYJ）

---

## 项目概述

**智享全链管理系统** — 白酒行业进销存 + 多租户 SaaS 平台。

- 后端：Express + TypeScript + MySQL（mock-db 模拟）
- 前端：Vue 3（admin-web, merchant-mobile, saas-admin）
- 小程序：miniapp
- 测试框架：Vitest + supertest
- 包管理：npm workspaces

---

## 架构分层

```
Routes → Services（含 ServiceContext: tenantId, userId, username, storeId）→ DAOs
```

- 路由层：`backend/src/routes/*.routes.ts`
- 服务层：`backend/src/services/*.service.ts`
- Mock DB：`backend/src/shared/mock-db.ts`（模拟数据库，测试环境使用）
- 数据库工具：`backend/src/shared/db.ts`（含 `queryWithTenant` 租户隔离）
- 多租户中间件：`requireAuthWithTenant`（`backend/src/shared/auth.ts`）

---

## 测试状态

**18 个测试文件，347 个测试全部通过** ✅

### 测试文件列表
- `src/__tests__/phase1-phase2-integration.test.ts` — 58 个集成测试（认证、租户隔离、供应商、采购订单、入库、退货、销售退货、对账、付款、跨模块、边界条件、分页）
- `src/__tests__/e2e.test.ts` — 9 个 E2E 测试（完整业务流程）
- `src/__tests__/supplier.test.ts` — 供应商单元测试
- `src/__tests__/purchase-order.test.ts` — 采购订单单元测试
- `src/__tests__/purchase-in-stock.test.ts` — 采购入库单元测试
- `src/__tests__/purchase-return.test.ts` — 采购退货单元测试
- `src/__tests__/sale-return.test.ts` — 销售退货单元测试
- `src/__tests__/customer-statement.test.ts` — 客户对账单单元测试
- `src/__tests__/customer-payment.test.ts` — 客户付款单元测试
- `tests/auth.test.ts` — JWT 认证单元测试
- `tests/inventory-fifo.test.ts` — 库存 FIFO 测试
- `tests/store-control.test.ts` — 门店控制测试
- `tests/order-timeout.test.ts` — 订单超时测试
- `tests/marketing.test.ts` — 营销测试
- `tests/price.test.ts` — 价格测试
- `tests/custom-report.test.ts` — 自定义报表测试
- `tests/order-sync.test.ts` — 订单同步测试
- `tests/tenant.test.ts` — 租户测试

---

## 关键修复记录

### mock-db.ts
1. **SQL 字面量处理**：INSERT 语句中的字面量（如 `'DRAFT'`、`0`）不计入参数，导致参数索引偏移。需要在 mock-db 中用正则提取字面量值。
2. **参数索引**：不同 service 的 INSERT 语句参数数量不同。tenant_id 始终取 `params[params.length - 1]`。
3. **供应商 INSERT 需要 tenant_id**：之前遗漏了 `tenant_id` 字段。
4. **status 大小写**：从 SQL 提取的 status 需 `.toUpperCase()` 匹配 service 层检查。

### db.ts
1. **queryWithTenant**：在 mock 环境下对结果进行租户过滤（`result.filter(row => row.tenant_id === tenantId)`），模拟生产环境的租户隔离。

### server.ts
1. **测试环境限流**：必须用 `if (process.env.NODE_ENV !== "test")` 包裹 `app.use(rateLimit(...))`，否则测试并发请求会触发 429。

### auth.test.ts
1. **vitest 兼容**：使用 `import { vi } from "vitest"` 替代 `jest.fn`。

### 生产代码 Bug（已修复）
1. **跨租户数据泄露**：事务查询缺少 `tenant_id` 过滤（`order.service.ts`）
2. **事务未包裹状态更新与日志**：`updateOrderStatus` 状态更新与日志插入未在同一事务
3. **conn.execute 返回格式**：mock-db 中 SELECT 需返回 `[rows, undefined]` 元组

---

## 常见陷阱

### 1. API 路径规则
- 管理员端：`/api/admin/*`（如 `/api/admin/purchase-orders`）
- 门店端：`/api/store/*`（如 `/api/store/sale-returns`）
- 采购入库是 `/api/admin/purchase-in-stocks`（复数）
- 采购退货是 `/api/admin/purchase-returns`
- 销售退货既有 `/api/admin/sale-returns` 也有 `/api/store/sale-returns`

### 2. 字段命名
- 请求体：camelCase（`supplierId`, `orderNo`）或 snake_case（`supplier_id`, `order_no`）取决于具体 API
- 响应体：snake_case（`stock_no`, `return_no`, `receipt_no`, `return_status`）
- 采购订单创建返回 `purchaseNo`（camelCase）
- 客户付款返回 `receipt_no`（snake_case）

### 3. 退款方式枚举
- 仅支持 `CASH`, `WECHAT`, `BANK`
- 不支持 `ALIPAY`

### 4. mock-db 限制
- 无真正的 SQL 解析，靠字符串匹配
- 事务用 `conn.execute()` 和 `conn.query()` 都需模拟
- 租户隔离需在 `queryWithTenant` 中手动过滤

### 5. 测试注意事项
- 集成测试中 mock-db 状态跨测试持久化（`resetMockDb()` 只在 `beforeAll` 调用一次）
- 测试执行顺序很重要，前面的测试会污染后面的测试数据
- 单独运行测试可能通过，一起运行可能失败（状态污染）

---

## 运行测试命令

```bash
# 全部测试
cd backend && npx vitest run

# 单个文件
npx vitest run src/__tests__/phase1-phase2-integration.test.ts

# 单个测试（按名称过滤）
npx vitest run -t "rejects negative box quantity"

# 详细输出
npx vitest run --reporter=verbose
```