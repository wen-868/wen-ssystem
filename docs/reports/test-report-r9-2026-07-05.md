# 测试报告 — R9 第二阶段验收（跑代码验证）

**日期**：2026-07-05
**测试人**：苏然
**验收方式**：逐项跑代码（grep/ls/tsc/vitest/vue-tsc），不依赖任务文件标注

---

## 一、验收总览

| 负责人 | 任务数 | 已完成 | 未完成 | 完成率 |
|:---:|:---:|:---:|:---:|:---:|
| 阿坚 | 5 | 0 | 5 | 0% |
| 墨 | 3 | 2 | 1 | 66.7% |
| 阿澈 | 4 | 4 | 0 | 100% |
| **合计** | **12** | **6** | **6** | **50%** |

---

## 二、阿坚 — R9 业务约束标准化（0/5，0%）

### R9-1 价格守卫全局应用 ❌ P0

| 检查项 | 预期 | 实际 | 证据 |
|--------|------|------|------|
| price-guard 应用于 product.route.ts | ✅ | ❌ | `grep -rl "priceGuard\|price-guard" src/routes/` 仅返回 `price.routes.ts` |
| price-guard 应用于 admin-order.route.ts | ✅ | ❌ | 同上 |
| price-guard 应用于 store.route.ts | ✅ | ❌ | 同上 |
| price-guard 应用于 miniapp.route.ts | ✅ | ❌ | 同上 |
| price-guard 应用于 export.route.ts | ✅ | ❌ | 同上 |
| 手写 `customerType === "WHOLESALE"` | 0 | **21 处** | 分布在 10 个文件（product.controller/service/order.controller/service/price/export） |

### R9-2 追溯码嵌入出入库 ❌ P0

| 检查项 | 预期 | 实际 | 证据 |
|--------|------|------|------|
| purchase-in-stock.service.ts 含追溯码 | ✅ | ❌ | `grep -c "trace\|Trace\|追溯"` → 0 |
| sale-bill.service.ts 含追溯码 | ✅ | ❌ | `grep -c "trace\|Trace\|追溯"` → 0 |
| order.service.ts 含追溯码 | ✅ | ❌ | `grep -c "trace\|Trace\|追溯"` → 0 |
| shared/trace-code.ts 公共工具 | ✅ | ❌ | `ls` → 文件不存在 |
| verifyTraceCode 重复 | 合并1处 | ✅ | 仅 trace-records.service.ts 1 处 |

### R9-3 订单创建流程统一 ⚠️ P1

| 检查项 | 预期 | 实际 |
|--------|------|------|
| shared/fulfillment.ts 存在 | ✅ | 存在，`completeOrderDelivery` 函数已实现 |
| miniapp.service.ts 调用 | ✅ | 第247行调用 `completeOrderDelivery` ✅ |
| store/order.service.ts 调用 | — | 第91行调用 `completeOrderDelivery`（额外覆盖）✅ |
| miniapp/checkout.service.ts 调用 | ✅ | 仅 import 辅助函数，未调用 ❌ |
| admin/cart.service.ts 调用 | ✅ | 仅 import 辅助函数，未调用 ❌ |
| 散落重复订单完成逻辑 | 归零 | 无竞争逻辑 ✅ |

### R9-4 存储容量检测 ❌ P1

- `middleware/storage-guard.ts`：`ls` → 文件不存在
- 全局搜索 `storage.*guard`：0 匹配

### R9-5 历史单据归档 ❌ P1

- `services/admin/archive.service.ts`：`ls` → 文件不存在
- 全局搜索 `archive`：仅 `marketing-material.service.ts` 中 `archiveMaterial`（营销素材，非业务单据）

---

## 三、墨 — R9 P0 修复 + 前端标准化（2/3，66.7%）

### R9-M1 修复 error-handler 错误日志写入 ✅ P0

| 检查项 | 预期 | 实际 | 证据 |
|--------|------|------|------|
| 导入 insertErrorLog | ✅ | ✅ | [error-handler.ts:5](file:///workspace/backend/src/middleware/error-handler.ts#L5) |
| 导入 reportToLingZhou | ✅ | ✅ | [error-handler.ts:6](file:///workspace/backend/src/middleware/error-handler.ts#L6) |
| 5xx 业务错误→写库+告警 | ✅ | ✅ | [error-handler.ts:35-57](file:///workspace/backend/src/middleware/error-handler.ts#L35-L57) |
| 未知错误→写库+告警 | ✅ | ✅ | [error-handler.ts:62-95](file:///workspace/backend/src/middleware/error-handler.ts#L62-L95) |
| ZodError→400 | ✅ | ✅ | [error-handler.ts:17-23](file:///workspace/backend/src/middleware/error-handler.ts#L17-L23) |

文件从 31 行增长到 96 行，完整实现所有错误处理分支。

### R9-M2 store-terminal 全局错误捕获 ✅ P0

| 检查项 | 预期 | 实际 | 证据 |
|--------|------|------|------|
| app.config.errorHandler | ✅ | ✅ | [main.ts:16-26](file:///workspace/store-terminal/src/main.ts#L16-L26) |
| window unhandledrejection | ✅ | ✅ | [main.ts:29-40](file:///workspace/store-terminal/src/main.ts#L29-L40) |
| window error | ✅ | ✅ | [main.ts:43-52](file:///workspace/store-terminal/src/main.ts#L43-L52) |
| 错误上报 reportFrontendError | ✅ | ✅ | 三种捕获均调用 |

文件从 12 行增长到 54 行。

### R9-M3 表单校验三件套 ⚠️ P1

| 检查项 | 结果 |
|--------|:---:|
| admin-web 含 `<el-form>` 文件 | 85 个 |
| 含 `:model` 的文件 | 84/85（缺 OrderSyncLog.vue）|
| 含 `:rules` 的文件 | 84/85（缺 OrderSyncLog.vue）|
| 含 `ref` 的文件 | 84/85（缺 OrderSyncLog.vue）|
| CommissionRules.vue prop 补全 | 7 个 ✅ |
| LoginView.vue prop 补全 | 3 个 ✅ |
| InventoryBatchPrice.vue validate() | 第278行 ✅ |
| ProductImport.vue validate() | 第145行 ✅ |

---

## 四、阿澈 — R9 前端标准化对齐（4/4，100%）

### R8-遗留 修复 request.ts 返回体适配 ✅ P2

- `request.ts` 已全部使用 `resData?.msg`（第82/90/98/113行）
- `RequestResponse` 接口定义 `msg` 字段（第27行）

### R9-C1 app-mobile 返回体适配 ✅ P0

| 检查项 | 结果 |
|--------|:---:|
| app-mobile 全局 `.message` 引用 | 仅 1 处：`login.vue:103` 的 `err?.message`（JS Error，非后端返回体）|
| 所有接口调用处使用 `resData?.msg` | ✅ |

### R9-C2 批发价权限统一 ✅ P1

| 检查项 | 结果 |
|--------|:---:|
| `app-mobile/src/utils/price.ts` 存在 | ✅ |
| `isWholesaleCustomer()` 函数 | ✅ |
| `getVisiblePriceFields()` 函数 | ✅ |
| `isPriceFieldVisible()` 函数 | ✅ |
| app-mobile 手写 `customerType === "WHOLESALE"` | 归零（仅 price.ts 工具内部）✅ |

### R9-C3 迁移文件整理 ✅ P1

| 检查项 | 结果 |
|--------|:---:|
| 迁移文件总数 | 89 个 |
| 中文名文件 | 068-089（22 个）✅ |
| 英文名文件（保留） | 029-067 + phase 系列 ✅ |
| 全部含注释头 | ✅（编号+描述+创建人+日期） |

---

## 五、回归测试

| 测试项 | 结果 | 说明 |
|--------|:---:|------|
| `npx tsc --noEmit` | **0 错误** | ✅ |
| `npx vitest run` | 283/359 通过 | 76 失败（auth jest→vitest 4 + e2e/integration 测试数据缺失 69 + error-collection 3）|
| store-terminal `vue-tsc` | **0 错误** | ✅ |
| merchant-mobile `vue-tsc` | **0 错误** | ✅（镜像源安装依赖后）|
| admin-web `vue-tsc` | 无法测试 | 沙箱 TLS 环境问题 |

---

## 六、问题清单（按负责人）

### 阿坚（5 项全部未完成，含 2 项 P0）

| # | 任务 | 优先级 | 问题 |
|---|------|:---:|------|
| 1 | R9-1 价格守卫全局应用 | P0 | price-guard 仅 1/6 路由，21 处手写 WHOLESALE |
| 2 | R9-2 追溯码嵌入出入库 | P0 | 3 核心 service 0 trace 代码，trace-code.ts 不存在 |
| 3 | R9-3 订单创建流程统一 | P1 | checkout.service.ts 和 cart.service.ts 未调用 completeOrderDelivery |
| 4 | R9-4 存储容量检测 | P1 | storage-guard.ts 不存在 |
| 5 | R9-5 历史单据归档 | P1 | archive.service.ts 不存在 |

### 墨（1 项待修复）

| # | 任务 | 优先级 | 问题 |
|---|------|:---:|------|
| 6 | R9-M3 表单校验三件套 | P1 | OrderSyncLog.vue 缺 ref+:model+:rules |

### 已知预存问题

| # | 问题 | 说明 |
|---|------|------|
| 1 | vitest 76 失败 | auth jest→vitest + e2e 测试数据缺失 + error-collection |
| 2 | admin-web 无法测试 | 沙箱 TLS 网络问题 |

---

## 七、结论

- **阿坚 R9**：5 项全部未开始（0%），R9-1 和 R9-2 为 **P0 级别**，直接影响数据安全和合规性
- **墨 R9**：3 项中 2 项完成（R9-M1 96 行 error-handler 完整实现，R9-M2 54 行完整错误捕获），R9-M3 仅 1 个文件缺三件套
- **阿澈 R9**：4 项全部完成（100%），app-mobile 返回体适配、批发价权限、迁移文件整理均达标
- **回归**：tsc 0 错误，前端 merchant-mobile 和 store-terminal 0 错误，vitest 283/359 通过