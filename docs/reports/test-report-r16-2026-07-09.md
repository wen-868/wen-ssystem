# R16 测试报告 — services 层测试覆盖第一批验收

> **检测时间：** 2026-07-09
> **检测人：** 苏然
> **任务来源：** R16-S1 覆盖率核查 + 全量回归
> **被验收人：** 阿坚（R16-A1 采购 / R16-A2 销售 / R16-A3 库存）
> **代码版本：** main 分支最新（2026-07-09，commit 通过 codeload 下载）
> **环境：** Node v24.18.0 / Vitest 4.1.10 / TypeScript 5.9.3 / Windows

---

## 一、验收范围

阿坚为 services 层 15 个文件编写 vitest 单元测试，声称覆盖率 100%：

| 模块 | 文件数 | 目标文件 |
|:---:|:---:|------|
| 采购 | 6 | purchase-order / purchase-return / purchase-in-stock / purchase-plan / purchase-payment / purchase-contract |
| 销售 | 3 | admin/order.service.ts / sale-return.service.ts / store/sale-bill.service.ts |
| 库存 | 6 | store/inventory.service.ts / admin/inventory-batch / inventory-cost / inventory-loss-gain / stock-check / stock-warning |

---

## 二、验收步骤与结果

### 2.1 环境准备

| 步骤 | 命令 | 结果 |
|:---:|------|:---:|
| 下载最新代码 | codeload.github.com 下载 zip | ✅ 4.1MB |
| 依赖安装 | `npm install --legacy-peer-deps`（踩坑 #17） | ✅ 522 packages, 0 vulnerabilities |
| TypeScript | `npx tsc --version` | 5.9.3 |
| Vitest | `npx vitest --version` | 4.1.10 |

> **注：** github.com 直连超时，改用 codeload.github.com 下载成功。项目为 workspaces 结构，依赖在根目录 node_modules。

### 2.2 TypeScript 类型检查

```
npx tsc --noEmit --strict
```

| 检查项 | 结果 |
|:---:|:---:|
| tsc --noEmit --strict | ✅ 0 错误（退出码 0） |

> tsconfig.json 已配置 `"strict": true`，`--strict` 参数等价生效。

### 2.3 services 层测试运行

```
npx vitest run src/__tests__/services --coverage
```

| 检查项 | 结果 |
|:---:|:---:|
| 测试文件数 | 15 passed (15) ✅ |
| 测试用例数 | 289 passed (289) ✅ |
| 失败数 | 0 ✅ |
| 耗时 | 5.07s |

**各文件测试用例数：**

| 文件 | 用例数 | 结果 |
|------|:---:|:---:|
| inventory-batch.test.ts | 44 | ✅ |
| stock-check.test.ts | 42 | ✅ |
| sale-bill.test.ts | 39 | ✅ |
| purchase-order.test.ts | 22 | ✅ |
| purchase-return.test.ts | 21 | ✅ |
| purchase-in-stock.test.ts | 24 | ✅ |
| order.test.ts | 19 | ✅ |
| purchase-payment.test.ts | 15 | ✅ |
| purchase-contract.test.ts | 12 | ✅ |
| purchase-plan.test.ts | 10 | ✅ |
| inventory.test.ts | 9 | ✅ |
| sale-return.test.ts | 17 | ✅ |
| inventory-cost.test.ts | 6 | ✅ |
| stock-warning.test.ts | 5 | ✅ |
| inventory-loss-gain.test.ts | 4 | ✅ |
| **合计** | **289** | **✅** |

### 2.4 覆盖率核查（lcov.info 精确数据）

从 `coverage/lcov.info` 提取 15 个目标文件的行/分支/函数覆盖率：

#### 采购模块（6 文件）— 全部 100% ✅

| 文件 | Lines | Branches | Functions |
|------|:---:|:---:|:---:|
| admin/purchase-order.service.ts | 100% | 100% | 100% |
| admin/purchase-return.service.ts | 100% | 100% | 100% |
| admin/purchase-in-stock.service.ts | 100% | 100% | 100% |
| admin/purchase-plan.service.ts | 100% | 100% | 100% |
| admin/purchase-payment.service.ts | 100% | 100% | 100% |
| admin/purchase-contract.service.ts | 100% | 100% | 100% |

#### 库存模块（6 文件）— 全部 100% ✅

| 文件 | Lines | Branches | Functions |
|------|:---:|:---:|:---:|
| store/inventory.service.ts | 100% | 100% | 100% |
| admin/inventory-batch.service.ts | 100% | 100% | 100% |
| admin/inventory-cost.service.ts | 100% | 100% | 100% |
| admin/inventory-loss-gain.service.ts | 100% | 100% | 100% |
| admin/stock-check.service.ts | 100% | 100% | 100% |
| admin/stock-warning.service.ts | 100% | 100% | 100% |

#### 销售模块（3 文件）— 2 个 100%，1 个 0% ❌

| 文件 | Lines | Branches | Functions | 结果 |
|------|:---:|:---:|:---:|:---:|
| sale-return.service.ts | 100% | 100% | 100% | ✅ |
| store/sale-bill.service.ts | 100% | 100% | 100% | ✅ |
| **admin/order.service.ts** | **0%** | **0%** | **0%** | **❌ P0** |

### 2.5 shared/ + middleware/ 覆盖率（无回退验证）

```
npx vitest run src/__tests__/shared/ src/__tests__/middleware/ --coverage
```

| 检查项 | 结果 |
|:---:|:---:|
| 测试文件数 | 24 passed (24) ✅ |
| 测试用例数 | 489 passed (489) ✅ |
| shared/ 覆盖率 | 100%（全部文件行/分支/函数均 100%）✅ |
| middleware/ 覆盖率 | 100%（全部文件行/分支/函数均 100%）✅ |

> 与 R15 基线一致，无回退。

### 2.6 全量回归测试

```
npx vitest run
```

| 检查项 | 结果 |
|:---:|:---:|
| 测试文件数 | 48 passed / 11 failed (59) |
| 测试用例数 | 1005 passed / 4 failed (1009) |
| 失败分类 | 4 个 jest 兼容 + 10 个套件加载失败 |

**失败分析（均为已知环境问题，非 R16 引入）：**

| 失败类型 | 数量 | 原因 | 踩坑日志 | 归类 |
|:---:|:---:|------|:---:|:---:|
| tests/auth.test.ts | 4 | `ReferenceError: jest is not defined`（jest.fn() 未替换为 vi.fn()） | #5 | 环境问题 |
| 旧集成测试套件 | 10 | `TypeError: Router.use() requires a middleware function`（auto-routes.ts 在 vitest ESM 下路由注册失败） | #1/#2 | 环境问题 |

**10 个 Failed Suites 明细（均为 src/__tests__/ 旧集成测试，非 R16 新增）：**
- customer-payment.test.ts
- customer-statement.test.ts
- e2e.test.ts
- error-collection.test.ts
- phase1-phase2-integration.test.ts
- purchase-in-stock.test.ts（旧）
- purchase-order.test.ts（旧）
- purchase-return.test.ts（旧）
- sale-return.test.ts（旧）
- supplier.test.ts

> **结论：** R16 新增 289 个 services 测试全部通过，无代码回归。4 + 10 失败均为历史已知环境问题，与 R15 基线一致。

---

## 三、Bug 列表

### BUG-R16-01 [P0] order.test.ts 导入路径错误，admin/order.service.ts 覆盖率 0%

| 字段 | 内容 |
|------|------|
| 编号 | BUG-R16-01 |
| 优先级 | **P0** |
| 负责人 | 阿坚 |
| 文件 | `backend/src/__tests__/services/admin/order.test.ts` 第 44 行 |
| 现象 | `admin/order.service.ts`（364 行，12 个导出函数）覆盖率 0%，阿坚声称销售模块 3 文件覆盖率 100% 不属实 |
| 根因 | order.test.ts 第 44 行导入 `from "../../../services/store/order.service.js"`，测试的是门店端 `store/order.service.ts`（170 行，7 函数），而非任务要求的 `admin/order.service.ts`。文件放在 `__tests__/services/admin/` 目录但导入路径指向 `store/` |
| 证据 | 1) order.test.ts 第 3 行注释：被测文件 src/services/store/order.service.ts；2) 第 44 行 import 路径为 store/order.service.js；3) lcov.info 显示 store/order.service.ts 100%、admin/order.service.ts 0% |
| 影响 | admin/order.service.ts 的 12 个函数（listOrders/exportOrdersCsv/getOrderDetail/getOrderStatusStats/listSaleBills/exportSaleBillsCsv/validateStatusTransition/cancelOrder/remarkOrder/updateOrderStatus/batchUpdateOrderStatus/getOrderOperationLogs）完全无测试覆盖 |
| 修复方向 | 将 order.test.ts 导入路径从 `../../../services/store/order.service.js` 改为 `../../../services/admin/order.service.js`，并按 admin/order.service.ts 的函数签名重写测试用例（参数、返回值结构不同） |
| 复现命令 | `cd backend && npx vitest run src/__tests__/services/admin/order.test.ts --coverage`，查看 lcov.info 中 admin/order.service.ts 覆盖率 |

---

## 四、踩坑日志 #21-24 验证

阿坚 R16 新增 4 条踩坑日志（#21-24），本次验收确认相关 bug 修复均已生效：

| 坑号 | 内容 | 验证结果 |
|:---:|------|:---:|
| #21 | `Number(x) ?? defaultValue` 死代码 → 改用逻辑或运算符 | ✅ inventory-batch.service.ts 中无 `Number(x) ??` 模式，覆盖率 100% |
| #22 | `query()` 返回 rows 非元组 → 去掉解构 | ✅ inventory-batch.service.ts 覆盖率 100%，测试通过 |
| #23 | `query()` INSERT 返回 ResultSetHeader → mock 按类型区分 | ✅ inventory-batch.test.ts 44 个用例全部通过 |
| #24 | `sql.includes("stock_check")` 匹配子串 → 先匹配长表名 | ✅ stock-check.test.ts 42 个用例全部通过 |

---

## 五、数据校正

| 指标 | 任务通知声称 | 实际验证 | 差异说明 |
|:---:|:---:|:---:|------|
| 原有测试数 | 499 | 720 | 任务通知数字不准确，实际原有 720（与 R15 记忆一致） |
| 新增测试数 | 289 | 289 | ✅ 一致 |
| 总测试数 | 788 | 1009 | 720 + 289 = 1009 |
| 采购覆盖率 | 100% | 100% | ✅ |
| 销售覆盖率 | 100% | **67%（2/3 文件）** | admin/order.service.ts 0% |
| 库存覆盖率 | 100% | 100% | ✅ |

---

## 六、风险评估

| 风险项 | 等级 | 说明 |
|:---:|:---:|------|
| admin/order.service.ts 零测试覆盖 | **高** | 364 行核心业务代码（订单列表/导出/详情/状态流转/批量更新/操作日志）无任何测试保护，回归风险极高 |
| 任务通知数据偏差 | 中 | 声称 788 实际 1009、声称销售 100% 实际 67%，需凌舟核对任务数据来源 |
| 旧集成测试套件失败 | 低 | 10 个套件因 auto-routes ESM 问题无法加载，属历史遗留（踩坑 #1/#2），非 R16 引入 |

---

## 七、验收结论

### 整体结论：条件性不通过

| 模块 | 结论 | 说明 |
|:---:|:---:|------|
| 采购模块（6 文件） | ✅ 通过 | 104 个用例通过，覆盖率 100% |
| 库存模块（6 文件） | ✅ 通过 | 110 个用例通过，覆盖率 100% |
| 销售模块（3 文件） | ❌ 不通过 | admin/order.service.ts 覆盖率 0%（BUG-R16-01） |
| tsc 类型检查 | ✅ 通过 | 0 错误 |
| shared/middleware 覆盖率 | ✅ 无回退 | 100% |
| 全量回归 | ✅ 无新增回归 | 4+10 失败均为已知环境问题 |

### 需阿坚修复后复验：

1. **[P0] BUG-R16-01：** 修正 order.test.ts 导入路径，为 admin/order.service.ts 编写真实测试，覆盖率达标 100% 后重新提交验收。

---

> **测试人：** 苏然
> **报告路径：** `docs/reports/test-report-r16-2026-07-09.md`
