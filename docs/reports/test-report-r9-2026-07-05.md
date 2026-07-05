# 测试报告 — R9 第二阶段验收（跑代码验证，非标注）

**日期**：2026-07-05
**测试人**：苏然
**验收方式**：逐项跑代码验证（grep/tsc/vitest/vue-tsc），不依赖任务文件标注

---

## 一、验收总览

| 任务 | 负责人 | 优先级 | 状态 | 验证方式 |
|------|:---:|:---:|:---:|------|
| R9-1 价格守卫全局应用 | 阿坚 | P0 | ❌ | grep 全路由文件 |
| R9-2 追溯码嵌入出入库 | 阿坚 | P0 | ❌ | grep 全 service 文件 |
| R9-3 订单创建流程统一 | 阿坚 | P1 | ⚠️ | grep 全源码引用 |
| R9-4 存储容量检测 | 阿坚 | P1 | ❌ | ls 文件存在性 |
| R9-5 历史单据归档 | 阿坚 | P1 | ❌ | ls 文件存在性 |

**完成率：0/5（0%），1 项部分完成不计入**

---

## 二、逐项验证详情

### R9-1 价格守卫全局应用 ❌

**验证命令**：
```
grep -rn "price.guard\|priceGuard" src/routes/ --include="*.ts"
grep -rn 'customerType === "WHOLESALE"' src/ --include="*.ts"
```

**验证结果**：

| 目标路由 | 预期 | 实际 | 证据 |
|----------|------|------|------|
| product.route.ts | 已应用 price-guard | **未应用** | grep 无匹配 |
| admin-order.route.ts | 已应用 price-guard | **未应用** | grep 无匹配 |
| store.route.ts | 已应用 price-guard | **未应用** | grep 无匹配 |
| miniapp.route.ts | 已应用 price-guard | **未应用** | grep 无匹配 |
| export.route.ts | 已应用 price-guard | **未应用** | grep 无匹配 |

- price-guard 仅应用于 `price.routes.ts`（12 处），未扩展到其他 5 个路由
- 手写 `customerType === "WHOLESALE"` 仍存 **21 处**，分布在 10 个文件：

| 文件 | 数量 |
|------|:---:|
| controllers/admin/product.controller.ts | 4 |
| controllers/admin-product.controller.ts | 3 |
| controllers/store-product.controller.ts | 3 |
| services/admin-product.service.ts | 3 |
| services/store-product.service.ts | 2 |
| controllers/admin-order.controller.ts | 2 |
| services/admin-order.service.ts | 1 |
| services/store/order.service.ts | 1 |
| controllers/price.controller.ts | 1 |
| controllers/export.controller.ts | 1 |

---

### R9-2 追溯码嵌入出入库业务流程 ❌

**验证命令**：
```
grep -rn "trace\|Trace\|追溯" src/services/admin/purchase-in-stock.service.ts src/services/store/sale-bill.service.ts src/services/store/order.service.ts
ls src/shared/trace-code.ts
grep -rn "verifyTraceCode" src/
```

**验证结果**：

| 目标文件 | 预期 | 实际 | 证据 |
|----------|------|------|------|
| purchase-in-stock.service.ts | 入库自动绑定追溯码 | **0 处 trace 相关代码** | grep 退出码 1（无匹配） |
| sale-bill.service.ts | 出库自动更新追溯码 | **0 处 trace 相关代码** | grep 退出码 1（无匹配） |
| order.service.ts | 订单关联追溯码 | **0 处 trace 相关代码** | grep 退出码 1（无匹配） |
| shared/trace-code.ts | 公共工具函数 | **文件不存在** | `ls: cannot access` |
| verifyTraceCode 重复 | 合并为 1 处 | 仅 1 处（trace-records.service.ts） | 本项已自然满足 |

---

### R9-3 订单创建流程统一 ⚠️

**验证命令**：
```
grep -rn "completeOrderDelivery\|from.*fulfillment" src/ --include="*.ts"
```

**验证结果**：

| 目标文件 | 预期调用 | 实际 |
|----------|----------|------|
| miniapp/checkout.service.ts | 调用 `completeOrderDelivery` | 仅 import `calcReservation` 和 `getInitialMiniappOrderState`，**未调用** `completeOrderDelivery` ❌ |
| admin/cart.service.ts | 调用 `completeOrderDelivery` | 仅 import `calcReservation` 和 `getInitialMiniappOrderState`，**未调用** `completeOrderDelivery` ❌ |
| miniapp.service.ts | 调用 `completeOrderDelivery` | 第 247 行调用 ✅ |
| store/order.service.ts | — | 第 91 行也调用了 ✅（额外覆盖） |

- `shared/fulfillment.ts` 存在，`completeOrderDelivery` 函数已实现
- 但 3 个目标文件中仅 1 个（miniapp.service.ts）实际调用统一入口
- checkout.service.ts 和 cart.service.ts 只 import 了辅助函数，未使用统一发货流程
- 无散落的重复订单完成逻辑（已清理）

---

### R9-4 存储容量检测 + 超限拦截 ❌

**验证命令**：
```
ls /workspace/backend/src/middleware/storage-guard.ts
grep -rn "storage.*guard\|storageGuard" src/ --include="*.ts"
```

**验证结果**：
- `middleware/storage-guard.ts`：**文件不存在**
- 全局搜索 `storage.*guard` / `storageGuard`：**0 匹配**

---

### R9-5 历史单据归档机制 ❌

**验证命令**：
```
ls /workspace/backend/src/services/admin/archive.service.ts
grep -rn "archive\|归档" src/services/admin/ --include="*.ts"
```

**验证结果**：
- `services/admin/archive.service.ts`：**文件不存在**
- 全局搜索 `archive` / `归档`：仅 `marketing-material.service.ts` 中有 `archiveMaterial`（营销素材归档，与业务单据无关）

---

## 三、回归测试

### 后端

| 测试项 | 结果 | 细节 |
|--------|:---:|------|
| `npx tsc --noEmit` | **0 错误** | 从 248→0 ✅ |
| `npx vitest run` | 283/359 通过 | 76 失败分 3 类：auth 4(jest→vitest)、e2e+integration 69(测试数据缺失)、error-collection 3(error-handler 未改造) |

### 前端

| 项目 | `vue-tsc --noEmit` | 说明 |
|------|:---:|------|
| merchant-mobile | **0 错误** | ✅ |
| store-terminal | **0 错误** | ✅（npm install 后） |
| admin-web | 无法测试 | node_modules 缺失（沙箱 TLS 环境问题） |

---

## 四、问题清单（按负责人）

### 阿坚（R9 全部 5 项）

| # | 任务 | 优先级 | 问题 | 证据 |
|---|------|:---:|------|------|
| 1 | R9-1 价格守卫全局应用 | P0 | price-guard 仅用于 price.routes.ts，5 个目标路由 0 处；21 处手写 WHOLESALE 未删除 | grep 全量扫描 |
| 2 | R9-2 追溯码嵌入出入库 | P0 | 三个核心 service 均 0 处 trace 代码；trace-code.ts 不存在 | grep 退出码 1 |
| 3 | R9-3 订单创建流程统一 | P1 | checkout.service.ts 和 cart.service.ts 未调用 `completeOrderDelivery`，仅 1/3 实现 | grep 源码引用 |
| 4 | R9-4 存储容量检测 | P1 | `middleware/storage-guard.ts` 不存在 | ls 文件不存在 |
| 5 | R9-5 历史单据归档 | P1 | `services/admin/archive.service.ts` 不存在 | ls 文件不存在 |

---

## 五、结论

R9 阶段 5 项业务约束标准化任务，经跑代码逐项验证后：

- **R9-1~R9-5 全部未完成**（0%），R9-3 有 1/3 部分覆盖但不计入完成
- R9-1（价格守卫）和 R9-2（追溯码）均为 **P0 级别**，直接影响数据安全和合规性，需最高优先级处理
- 后端 tsc 0 错误是亮点，但 R9 业务代码本身尚未开始编写