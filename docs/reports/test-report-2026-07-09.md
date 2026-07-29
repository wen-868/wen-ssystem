# R17 验收测试报告

> 测试人：苏然  
> 测试日期：2026-07-09  
> 验收对象：阿坚 R17 成果（services 层 24 文件 vitest 单元测试）  
> 仓库：https://github.com/wen-868/wen-ssystem  
> 测试环境：vitest 4.1.10 / node v24.18.0 / v8 coverage / Windows

---

## 一、测试范围

验收阿坚 R17 三个子任务的 services 层单元测试，共 24 个文件、369 个用例：

| 子任务 | 模块 | 文件数 | 用例数 | 文件清单 |
|--------|------|--------|--------|----------|
| R17-A1 | 客户模块 | 10 | 159 | customer / visit / tag / statement / segment / price / payment / merge / lifecycle / care |
| R17-A2 | 信用模块 | 5 | 75 | credit-limit / collection / adjust / scoring / risk |
| R17-A3 | 财务模块 | 9 | 135 | finance-dashboard / receipt / receivable / reconciliation / expense / payment / payment-new / payment-config / daily-settlement |
| **合计** | — | **24** | **369** | — |

验收三步法：环境准备 → 覆盖率核查 → 全量回归。

---

## 二、第二步：覆盖率核查

### 2.1 测试用例通过情况

命令：`npx vitest run src/__tests__/services --coverage`

结果：**39 个测试文件全部通过，673 个用例全部通过，0 失败**。

R17 三模块用例数核对（与阿坚声称一致）：

| 模块 | 文件 | 用例数 |
|------|------|--------|
| 客户 | customer.test.ts | 31 |
| 客户 | customer-visit.test.ts | 25 |
| 客户 | customer-tag.test.ts | 16 |
| 客户 | customer-statement.test.ts | 13 |
| 客户 | customer-segment.test.ts | 13 |
| 客户 | customer-price.test.ts | 12 |
| 客户 | customer-payment.test.ts | 15 |
| 客户 | customer-merge.test.ts | 15 |
| 客户 | customer-lifecycle.test.ts | 6 |
| 客户 | customer-care.test.ts | 13 |
| 信用 | credit-limit.test.ts | 25 |
| 信用 | credit-collection.test.ts | 15 |
| 信用 | credit-adjust.test.ts | 8 |
| 信用 | credit-scoring.test.ts | 25 |
| 信用 | credit-risk.test.ts | 2 |
| 财务 | finance-dashboard.test.ts | 12 |
| 财务 | receipt.test.ts | 19 |
| 财务 | receivable.test.ts | 10 |
| 财务 | reconciliation.test.ts | 10 |
| 财务 | expense.test.ts | 16 |
| 财务 | payment.test.ts | 19 |
| 财务 | payment-new.test.ts | 19 |
| 财务 | payment-config.test.ts | 23 |
| 财务 | daily-settlement.test.ts | 7 |
| **合计** | | **369** |

### 2.2 覆盖率核查（lcov.info 精确解析）

R17 的 24 个文件覆盖率**全部 100%**（lines / branches / functions 三项均为 100%）：

| 文件 | 行覆盖(LH/LF) | 分支覆盖(BRH/BRF) | 函数覆盖(FNH/FNF) |
|------|---------------|-------------------|-------------------|
| customer.service.ts | 76/76 (100%) | 78/78 (100%) | 14/14 (100%) |
| customer-visit.service.ts | 137/137 (100%) | 118/118 (100%) | 10/10 (100%) |
| customer-tag.service.ts | 40/40 (100%) | 40/40 (100%) | 9/9 (100%) |
| customer-statement.service.ts | 51/51 (100%) | 34/34 (100%) | 6/6 (100%) |
| customer-segment.service.ts | 43/43 (100%) | 36/36 (100%) | 8/8 (100%) |
| customer-price.service.ts | 38/38 (100%) | 28/28 (100%) | 5/5 (100%) |
| customer-payment.service.ts | 52/52 (100%) | 46/46 (100%) | 6/6 (100%) |
| customer-merge.service.ts | 71/71 (100%) | 50/50 (100%) | 10/10 (100%) |
| customer-lifecycle.service.ts | 21/21 (100%) | 7/7 (100%) | 3/3 (100%) |
| customer-care.service.ts | 45/45 (100%) | 38/38 (100%) | 6/6 (100%) |
| credit-limit.service.ts | 104/104 (100%) | 36/36 (100%) | 10/10 (100%) |
| credit-collection.service.ts | 74/74 (100%) | 54/54 (100%) | 6/6 (100%) |
| credit-adjust.service.ts | 27/27 (100%) | 12/12 (100%) | 3/3 (100%) |
| credit-scoring.service.ts | 76/76 (100%) | 73/73 (100%) | 9/9 (100%) |
| credit-risk.service.ts | 4/4 (100%) | 2/2 (100%) | 1/1 (100%) |
| finance-dashboard.service.ts | 35/35 (100%) | 44/44 (100%) | 7/7 (100%) |
| receipt.service.ts | 41/41 (100%) | 38/38 (100%) | 6/6 (100%) |
| receivable.service.ts | 31/31 (100%) | 16/16 (100%) | 6/6 (100%) |
| reconciliation.service.ts | 30/30 (100%) | 20/20 (100%) | 6/6 (100%) |
| expense.service.ts | 45/45 (100%) | 56/56 (100%) | 7/7 (100%) |
| payment.service.ts | 48/48 (100%) | 26/26 (100%) | 6/6 (100%) |
| payment-new.service.ts | 42/42 (100%) | 40/40 (100%) | 6/6 (100%) |
| payment-config.service.ts | 29/29 (100%) | 56/56 (100%) | 11/11 (100%) |
| daily-settlement.service.ts | 38/38 (100%) | 24/24 (100%) | 3/3 (100%) |

### 2.3 类型检查

命令：`npx tsc --noEmit --strict`

结果：**退出码 0，0 错误**。

### 2.4 导入路径核对（R16 教训 #25）

grep 检查 24 个测试文件的 import 路径，**全部为 admin 版本**（`../../../services/admin/xxx.service.js`），无 store 版本误用。踩坑日志 #25 教训已规避。

> 备注：`inventory.test.ts` 和 `sale-bill.test.ts` 导入 store 版本，但这两个 service 仅存在于 store 端（admin 无同名文件），属正确行为，且不在 R17 范围。

---

## 三、第三步：全量回归

### 3.1 全量测试结果

命令：`npx vitest run --coverage`

结果：83 个测试文件，4 failed | 1389 passed (1393 用例)。

### 3.2 失败分析（历史遗留，非 R17 引入）

14 个失败分两类，均为 R17 之前就存在的已知问题：

| 类别 | 文件 | 失败数 | 根因 | 关联踩坑 |
|------|------|--------|------|----------|
| jest API 未替换 | tests/auth.test.ts | 4 用例 | `ReferenceError: jest is not defined`（使用 jest.fn() 而非 vi.fn()） | #5 (2026-07-05) |
| auto-routes 收集失败 | src/__tests__/ 根目录 10 个旧集成测试 | 10 文件 | `Router.use() requires a middleware function`（import server.ts 触发路由注册错误） | #1/#2 (2026-07-05) |

这 10 个旧文件修改时间为 2026-07-08（R17 之前），是历史遗留的 Phase 2 集成测试。R17 新测试文件在 `src/__tests__/services/admin/` 下（2026-07-09），与此无关。

### 3.3 排除历史失败后的全量结果

排除 11 个历史失败文件后：**72 个测试文件全部通过，1362 个用例全部通过，0 失败**。

### 3.4 覆盖率无回退

- R17 仅新增 24 个 100% 覆盖的测试文件，未删除/修改任何现有测试
- R17 涉及的源码修改（踩坑 #26-30）均在 24 个文件范围内，不影响其他模块
- 全局覆盖率 31.43%（项目整体现状，大量模块未测试），R17 的 24 个目标文件均 100%
- 结论：**覆盖率无回退**

---

## 四、通过率汇总

| 项目 | 通过/总数 | 通过率 |
|------|-----------|--------|
| R17 新增测试（三模块） | 369/369 | 100% |
| services 目录测试 | 673/673 | 100% |
| 全量测试（排除历史失败） | 1362/1362 | 100% |
| tsc --noEmit --strict | 0 错误 | 100% |

---

## 五、Bug 列表

本次验收**未发现新增 bug**。R17 三模块成果全部达标。

---

## 六、风险评估

### 6.1 历史遗留失败（建议后续修复，非 R17 责任）

| 问题 | 文件 | 根因 | 关联踩坑 | 建议 |
|------|------|------|----------|------|
| jest.fn() 未替换 | tests/auth.test.ts | 使用 jest API | #5 | 将 jest.fn() 替换为 vi.fn() |
| auto-routes 收集失败 | src/__tests__/ 根目录 10 个旧文件 | import server.ts 触发路由注册错误 | #1/#2 | 评估删除旧集成测试或修复 auto-routes |

### 6.2 全量测试收集失败中断覆盖率报告

vitest 在有测试文件收集失败（import 抛错）时，会中断覆盖率报告生成。本次全量测试因此未生成全局覆盖率报告，需排除失败文件后单独运行。建议后续清理收集失败的旧测试文件。

### 6.3 代码版本核对

通过 GitHub API 核对 credit-risk.test.ts 的 size（GitHub 1584 bytes vs 本地 1630 bytes，差值 46 字节恰好为 CRLF/LF 行尾符差异），确认本地代码为阿坚 R17 完成后的最新版本。

---

## 七、验收结论

**通过**。

R17 三模块 24 个 service 文件单元测试全部达标：

- [x] 客户模块 10 文件覆盖率 100%
- [x] 信用模块 5 文件覆盖率 100%
- [x] 财务模块 9 文件覆盖率 100%
- [x] 所有测试用例通过，0 失败（369/369）
- [x] `npx tsc --noEmit --strict` 0 错误
- [x] 导入路径全部 admin 版本（#25 教训已规避）
- [x] 原有测试无回退（历史失败为已知问题）
- [x] 新增 services 测试全部通过
- [x] 覆盖率报告无回退
