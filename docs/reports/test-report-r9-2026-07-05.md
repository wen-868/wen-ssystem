# 测试报告 — R9 第二阶段验收（第三次验证，跑代码+编译）

**日期**：2026-07-05
**测试人**：苏然
**验收方式**：逐项跑代码（grep编译/ls/wc/npm build），不依赖标注

---

## 一、验收总览

| 负责人 | 任务数 | 已完成 | 未完成 | 完成率 |
|:---:|:---:|:---:|:---:|:---:|
| 阿坚 | 5 | 0 | 5 | 0% |
| 墨 | 3 | 2 | 1 | 66.7% |
| 阿澈 | 4 | 4 | 0 | 100% |
| **合计** | **12** | **6** | **6** | **50%** |

---

## 二、阿坚 — R9 业务约束标准化（0/5）

### R9-1 价格守卫全局应用 ❌

| 检查项 | 命令 | 结果 |
|--------|------|:---:|
| 路由文件总数 | `ls src/routes/*.ts \| wc -l` | 120 |
| 使用 price-guard 的路由 | `grep -rln "price-guard\|priceGuard" src/routes/` | 1 个（price.routes.ts） |
| 价格敏感路由数 | `ls src/routes/*.ts \| grep -iE "product\|order\|price\|export\|miniapp\|store"` | 23 个 |
| 手写 `customerType === "WHOLESALE"` | `grep -rn "customerType.*WHOLESALE\|WHOLESALE.*customerType" src/` | **21 处 8 个文件** |

price-guard 中间件本身功能完整（5个函数：requirePriceFieldAccess/requirePriceLevelAccess/requirePriceManagementAccess/requirePriceChangeLogAccess/priceResponseFilter），但仅应用于 price.routes.ts。21 处手写 WHOLESALE 分布在：

| 文件 | 数量 |
|------|:---:|
| services/miniapp.service.ts | 6 |
| services/admin/cart.service.ts | 5 |
| services/miniapp/checkout.service.ts | 3 |
| services/store/sale-bill.service.ts | 2 |
| routers/miniapp.routes.ts | 1 |
| controllers/miniapp.controller.ts | 1 |
| controllers/admin/miniapp.controller.ts | 1 |
| routers/admin-cart.routes.ts | 1 |
| ... | 1 |

### R9-2 追溯码嵌入出入库 ❌

| 检查项 | 命令 | 结果 |
|--------|------|:---:|
| purchase-in-stock.service.ts | `grep -c "trace\|Trace\|追溯"` | **0** |
| sale-bill.service.ts | `grep -c "trace\|Trace\|追溯"` | **0** |
| order.service.ts | `grep -c "trace\|Trace\|追溯"` | **0** |
| shared/trace-code.ts | `ls -la` | 不存在 |
| 全代码 generateTrace 函数 | `grep -rn "generateTraceCode\|createTraceCode\|bindTraceCode" src/` | 0 匹配 |

### R9-3 订单创建流程统一 ⚠️

| 文件 | 导入 fulfillment 函数 | 调用 completeOrderDelivery |
|------|------|:---:|
| miniapp.service.ts | calcReservation, getInitialMiniappOrderState, completeOrderDelivery | ✅ |
| store/order.service.ts | completeOrderDelivery | ✅ |
| miniapp/checkout.service.ts | calcReservation, getInitialMiniappOrderState | ❌ |
| admin/cart.service.ts | calcReservation, getInitialMiniappOrderState | ❌ |

- fulfillment.ts 提供 4 个函数，completeOrderDelivery 为统一发货入口
- 2/4 文件调用 completeOrderDelivery，2 个仅用辅助函数
- 无散落竞争订单完成逻辑（经 `grep -rn "completeOrder\|finishOrder\|deliverOrder"` 验证）

### R9-4 存储容量检测 ❌

| 检查项 | 命令 | 结果 |
|--------|------|:---:|
| middleware/storage-guard.ts | `ls -la` | 不存在 |
| 全局 storage 相关 | `grep -rn "storage.*guard\|storageGuard\|max_storage" src/` | 0 匹配 |

### R9-5 历史单据归档 ❌

| 检查项 | 命令 | 结果 |
|--------|------|:---:|
| services/admin/archive.service.ts | `ls -la` | 不存在 |
| 全局归档逻辑 | `grep -rn "archive\|归档" src/services/admin/` | 0 匹配（仅 marketing-material.service.ts 的 archiveMaterial） |

---

## 三、墨 — R9 P0 修复 + 前端标准化（2/3）

### R9-M1 修复 error-handler 错误日志写入 ✅

| 检查项 | 命令 | 结果 |
|--------|------|:---:|
| 文件行数 | `wc -l` | 95 行 |
| insertErrorLog 调用 | `grep -n "insertErrorLog"` | **2 处**（5xx 分支 + 未知错误分支） |
| reportToLingZhou 调用 | `grep -n "reportToLingZhou"` | **2 处**（同上） |
| ZodError 分支 | `grep -n "ZodError"` | 第 17 行，返回 400 + 字段错误 |

### R9-M2 store-terminal 全局错误捕获 ✅

| 检查项 | 命令 | 结果 |
|--------|------|:---:|
| 文件行数 | `wc -l` | 54 行 |
| app.config.errorHandler | `grep -n "errorHandler"` | 第 16 行 ✅ |
| unhandledrejection | `grep -n "unhandledrejection"` | 第 29 行 ✅ |
| window error | `grep -n "window.*error"` | 第 43 行 ✅ |
| reportFrontendError 调用 | `grep -n "reportFrontendError"` | **3 处** ✅ |

### R9-M3 表单校验三件套 ⚠️

| 检查项 | 命令 | 结果 |
|--------|------|:---:|
| 含 el-form 文件数 | `grep -rl '<el-form' src/views/ \| wc -l` | 85 |
| 缺 :model | 逐文件检查 | 0 个 ✅ |
| 缺 :rules | 逐文件检查 | **1 个**（OrderSyncLog.vue） |
| 缺 ref | 逐文件检查 | **1 个**（OrderSyncLog.vue） |

---

## 四、阿澈 — R9 前端标准化对齐（4/4）

### R9-C1 app-mobile 返回体适配 ✅

| 检查项 | 命令 | 结果 |
|--------|------|:---:|
| request.ts msg 字段 | `grep -n "msg\|message" src/api/request.ts` | 接口定义 `msg: string`（第27行），`resData?.msg` 统一使用（第82/90/98/113行） |
| 全局 .message 引用 | `grep -rn '\.message' src/` | 仅 1 处：login.vue:103 `err?.message`（JS Error，非后端返回体） |

### R9-C2 批发价权限统一 ✅

| 检查项 | 命令 | 结果 |
|--------|------|:---:|
| price.ts 工具 | `cat src/utils/price.ts` | 4 个函数：isWholesaleCustomer / isRetailCustomer / getVisiblePriceFields / isPriceFieldVisible |
| 手写 WHOLESALE | `grep -rn 'customerType.*WHOLESALE'` | 仅 price.ts 工具内部（第3行注释 + 第18行实现），业务代码归零 |

### R9-C3 迁移文件整理 ✅

| 检查项 | 命令 | 结果 |
|--------|------|:---:|
| 中文名文件 | `ls *.sql \| grep -E "^06[8-9]\|^0[7-8][0-9]\|^089"` | 22 个（068-089） |
| 注释头 | `head -4 068_银行费用发票.sql` | 编号/描述/创建人/日期 完整 ✅ |
| 缺注释头 | 逐文件检查 | 0 个 ✅ |

---

## 五、回归测试

| 测试项 | 结果 |
|--------|:---:|
| backend `npx tsc --noEmit` | **0 错误** |
| backend `npx vitest run` | 283/359 通过（76 失败：auth jest→vitest 4 + e2e/integration 69 + error-collection 3） |
| merchant-mobile `npx vue-tsc --noEmit` | **0 错误** |
| store-terminal `npx vue-tsc --noEmit` | **0 错误** |
| admin-web `npx vue-tsc --noEmit` | 无法测试（沙箱 TLS） |

---

## 六、问题清单

### 阿坚（5 项全部未完成）

| # | 任务 | 优先级 | 问题 |
|---|------|:---:|------|
| 1 | R9-1 价格守卫全局应用 | P0 | price-guard 仅 1/120 路由，21 处手写 WHOLESALE |
| 2 | R9-2 追溯码嵌入出入库 | P0 | 3 核心 service 0 trace 代码，trace-code.ts 不存在 |
| 3 | R9-3 订单创建流程统一 | P1 | checkout.service.ts 和 cart.service.ts 未调用 completeOrderDelivery |
| 4 | R9-4 存储容量检测 | P1 | storage-guard.ts 不存在，全局 0 匹配 |
| 5 | R9-5 历史单据归档 | P1 | archive.service.ts 不存在，全局 0 匹配 |

### 墨（1 项待修复）

| # | 任务 | 优先级 | 问题 |
|---|------|:---:|------|
| 6 | R9-M3 表单校验三件套 | P1 | OrderSyncLog.vue 缺 ref+:model+:rules |

---

## 七、结论

三次验证结果一致：
- **阿坚**：R9 5 项全部未开始（0%），R9-1/R9-2 为 P0 级别
- **墨**：R9-M1（95行 error-handler）和 R9-M2（54行 全局错误捕获）已完工，R9-M3 仅 1 个文件缺三件套
- **阿澈**：4 项全部完工（100%）
- **回归**：tsc 0 错误，前端 0 错误，vitest 283/359 通过