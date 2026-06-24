
# 智享营销系统 - 第 2 阶段 测试计划 (Sprint 1)

> 版本: v1.0
> 生效日期: 2026/06/17
> 负责人: 苏然（测试工程师）

---

## 1. 测试范围与目标

### 1.1 业务模块

| 模块 | 说明 | 严重级别默认 |
|---|---|---|
| 供应商管理 | 供应商档案、联系人、状态切换 | P1 |
| 采购订单 | 创建 → 提交 → 审核 → 入库 → 付款 | P0 |
| 销售退货 | 创建 → 提交 → 审核 → 入库(库存回滚) → 退款 | P0 |
| 客户对账/收款 | 自动对账、收款登记、分享收款链接 | P0 |
| 库存预警 | 预警规则、预警事件、低库存快照 | P1 |

### 1.2 系统信息

| 项目 | 信息 |
|---|---|
| 数据库结构 | [phase2_schema.sql](file:///workspace/docs/phase2_schema.sql) |
| 接口定义 | [phase2_openapi.yaml](file:///workspace/docs/phase2_openapi.yaml) |
| 第 1 阶段接口定义 | [phase1_openapi.yaml](file:///workspace/docs/phase1_openapi.yaml) |
| API 基础地址 | http://localhost:8080/api |

### 1.3 测试目标

1. 验证所有接口的请求/响应结构符合 OpenAPI 定义；
2. 验证核心业务流程（采购/退货/对账/收款/库存）符合设计预期；
3. 验证关键状态流转（DRAFT→SUBMITTED→AUDITED→COMPLETED）；
4. 验证金额计算精度（保留 2 位小数，边界值 0.01、大额、负数拒绝）；
5. 验证并发场景（库存变更、重复提交、乐观锁冲突）；
6. 验证异常输入（缺失字段、负数、超界）；
7. 验证权限控制（未登录访问受限接口返回 401）。

### 1.4 准入/准出标准

**准入:**
- 后端第 2 阶段接口已实现并可通过 `/health`；
- 第 1 阶段核心接口回归通过；
- 数据库 Schema 已建好并 seed 初始数据。

**准出:**
- P0 用例通过率 = 100%；
- P1 用例通过率 ≥ 95%；
- 已发现的 P0/P1 Bug 均已修复并回归通过；
- 金额精度、状态流转、并发场景通过。

---

## 2. 测试策略

### 2.1 方法

| 类型 | 方法 | 工具 |
|---|---|---|
| 接口功能测试 | HTTP 请求/响应验证 | Node.js 自动化脚本 + 手工验证 |
| 状态流转测试 | 按顺序调用状态流转接口，检查数据一致性 | 手工 + 脚本 |
| 金额精度测试 | 边界值/等价类划分 | 脚本 |
| 并发测试 | 多线程/并发请求模拟 | Node.js `Promise.all` |
| 异常测试 | 缺失字段/越界值/非法状态 | 脚本 |
| 权限测试 | 未登录 / 伪造 token / 越权访问 | 脚本 |
| 数据库一致性 | 业务操作后检查 balance/ledger 表一致性 | 脚本 |

### 2.2 环境

```text
MySQL:  8.4 / liquor_inventory / 已初始化 phase2_schema.sql
Redis:  7.0+ (可选)
后端:   http://localhost:8080
账号:   admin / admin123
```

### 2.3 测试数据管理

- 测试脚本使用 `DELETE FROM xxx WHERE created_at >= '...'` 清理；
- 新增数据使用 `测试_` 前缀标识；
- 不使用生产环境执行压测与异常注入。

---

## 3. 交付物

| 交付物 | 文件 | 状态 |
|---|---|---|
| 测试计划文档 | `tests/docs/test-plan-phase2.md`（本文件） | ✅ |
| 功能测试用例 | `tests/docs/test-cases-phase2.md` | ⬜ |
| 接口自动化脚本 | `tests/phase2-api-test-suite.mjs` | ⬜ |

---

## 4. 严重级别定义

| 级别 | 定义 | 示例 |
|---|---|---|
| P0 (Critical) | 阻断业务主流程、数据损坏、金额计算错误 | 采购入库不扣减库存；销售退货金额为负；分享收款金额与应收不一致；状态流转错误导致不可继续 |
| P1 (Major) | 功能存在明显缺陷但可绕开；字段/编码生成规则错误；响应字段缺失/错名 | 供应商编号规则错误；列表字段缺失；低库存预警不触发；对账明细与合计不一致 |
| P2 (Minor) | UI/文案问题、不影响业务 | 按钮位置；字段标签错误；响应时间略高 |

---

## 5. 核心业务流程列表

以下为脚本与手工测试的核心流程路径（SOP）：

### 5.1 采购流程

```text
DRAFT  →  SUBMITTED  →  AUDITED  →  INBOUND_PARTIAL  →  INBOUND_COMPLETED
           \         \         \
            取消(CANCELLED)     付款 UNPAID → PARTIAL → PAID
```

关键验证点：
- 入库后 `inventory_balance.physical_qty` 增加；
- `inventory_ledger` 新增记录，`before/after_qty` 正确；
- 采购订单明细 `inbound_qty` 累积正确；
- 金额重新计算（`goods_amount = Σ(unit_price * qty)`）。

### 5.2 销售退货流程

```text
DRAFT  →  SUBMITTED  →  AUDITED  →  STOCK_IN  →  COMPLETED
           \         \         \
            \         \         退款 UNREFUNDED → PARTIAL → REFUNDED
             CANCELLED
```

关键验证点：
- 审核通过后 `stockRollbackFlag=1`，库存加回；
- 退款金额 ≤ `refundAmount`；
- 原订单/销售单状态同步更新。

### 5.3 客户对账/收款流程

```text
自动生成 (DRAFT)  →  确认 (CONFIRMED)  →  收款 (PARTIAL / PAID)  →  结清 (SETTLED)
                                \                               \
                                 \_ 生成分享收款链接               \_ 单笔收款登记
```

关键验证点：
- 期末余额 = 期初 + 销售 - 退货 - 收款；
- 明细借贷金额与合计一致；
- 收款金额不超过未收金额。

### 5.4 库存预警流程

```text
规则表 (warning_rule)  →  扫描 inventory_balance  →  生成事件 (warning_event)
                                                    ↓
                                              PENDING → ACKNOWLEDGED → RESOLVED
```

关键验证点：
- `available_qty ≤ threshold` 时生成事件；
- 同一 SKU 同一规则不重复生成；
- 手动触发接口工作。

---

## 6. 专项测试设计

### 6.1 金额精度边界值

| 用例编号 | 场景 | 输入 | 预期 |
|---|---|---|---|
| TC-PREC-001 | 单价 0.01 元 × 1 瓶 | unitPrice=0.01, qty=1 | subtotal=0.01 |
| TC-PREC-002 | 单价 0.01 元 × 10000 瓶 | unitPrice=0.01, qty=10000 | subtotal=100.00 |
| TC-PREC-003 | 单价 99999.99 元 × 1 瓶 | unitPrice=99999.99, qty=1 | subtotal=99999.99 |
| TC-PREC-004 | 单价 1.235 元（3 位小数） | unitPrice=1.235 | 四舍五入为 1.24 或拒绝 |
| TC-PREC-005 | 单价负数 | unitPrice=-10 | HTTP 400 或字段校验失败 |
| TC-PREC-006 | 数量 0 | qty=0 | subtotal=0.00（允许或拒绝视业务定义） |
| TC-PREC-007 | 数量负数 | qty=-1 | 拒绝 |
| TC-PREC-008 | 多币种/汇率 | 非人民币（暂不支持） | 忽略 |
| TC-PREC-009 | 小计 = 单价 × 数量（10 条明细验证） | 多条 items | goods_amount 等于各明细之和 |
| TC-PREC-010 | 应收 100，已收 50，再收 50.01 | 金额超支 | 拒绝或给出明确提示 |

### 6.2 状态流转路径

**采购订单状态机**

| 起始状态 | 操作 | 目标状态 | 用例 |
|---|---|---|---|
| DRAFT | POST submit | SUBMITTED | TC-STAT-PO-001 |
| SUBMITTED | POST audit(passed=true) | AUDITED | TC-STAT-PO-002 |
| SUBMITTED | POST audit(passed=false) | SUBMITTED（退回 DRAFT 由业务决定） | TC-STAT-PO-003 |
| AUDITED | POST inbound（部分） | INBOUND_PARTIAL | TC-STAT-PO-004 |
| INBOUND_PARTIAL | POST inbound（剩余） | INBOUND_COMPLETED | TC-STAT-PO-005 |
| DRAFT | POST cancel | CANCELLED | TC-STAT-PO-006 |
| CANCELLED | POST submit | 400（已取消不能再提交） | TC-STAT-PO-007 |
| INBOUND_COMPLETED | POST pay | UNPAID→PAID | TC-STAT-PO-008 |

**销售退货状态机**

| 起始状态 | 操作 | 目标状态 | 用例 |
|---|---|---|---|
| DRAFT | POST submit | SUBMITTED | TC-STAT-RET-001 |
| SUBMITTED | POST audit | AUDITED | TC-STAT-RET-002 |
| AUDITED | POST stock-in | INBOUND/COMPLETED | TC-STAT-RET-003 |
| COMPLETED | POST refund | REFUNDED | TC-STAT-RET-004 |
| DRAFT | POST cancel | CANCELLED | TC-STAT-RET-005 |
| CANCELLED | 继续操作 | 拒绝 | TC-STAT-RET-006 |

**对账单状态机**

| 起始状态 | 操作 | 目标状态 | 用例 |
|---|---|---|---|
| DRAFT | POST confirm | CONFIRMED | TC-STAT-STMT-001 |
| CONFIRMED | POST payment（部分） | PARTIAL | TC-STAT-STMT-002 |
| PARTIAL | POST payment（剩余） | PAID | TC-STAT-STMT-003 |
| PAID | 再 POST payment | 拒绝（超出 closing_balance） | TC-STAT-STMT-004 |

### 6.3 并发操作测试

| 用例 | 场景 | 预期 |
|---|---|---|
| TC-CONC-001 | 10 个请求并发创建同一 SKU 的销售单 | 库存 balance.physical_qty 正确减少；ledger 条数 = 10 |
| TC-CONC-002 | 10 个请求并发 POST 同一个采购订单入库 | 仅 1 次完整入库成功，其他拒绝或按部分入库；库存不乱 |
| TC-CONC-003 | 同一销售单并发 POST `offline-payment`（均收款 100，应收 100） | 仅 1 条付款成功，其他返回 "已付款"或累计金额为 100 |
| TC-CONC-004 | 并发 POST `statements/generate`（同一客户+账期） | 只有一个对账单生成，其他返回"已存在"或幂等 |
| TC-CONC-005 | 并发 POST `sales-returns/{returnNo}/stock-in` | 仅 1 次回滚成功，库存不被重复增加 |

---

## 7. 缺陷管理流程

1. 发现问题 → 记录到测试用例文档（FAIL 标记）；
2. 同步给开发（@对应后端开发）；
3. 修复后 → 回归测试脚本重跑该路径；
4. P0 必须当天反馈、隔天修复；
5. 每日站会同步阻塞项。

---

## 8. 里程碑

| 阶段 | 时间 | 产出 |
|---|---|---|
| 测试计划 + 用例设计 | 6/17–6/19 | 本文件、test-cases-phase2.md |
| 接口自动化脚本搭建 | 6/19–6/20 | `tests/phase2-api-test-suite.mjs` |
| 第一轮接口执行 & Bug 记录 | 6/20–6/21 | 缺陷清单 |
| 第二轮回归 & 状态机/并发验证 | 6/21–6/22 | 回归报告 |
| 第三轮验收 (P0 清零) | 6/22–6/24 | 测试报告 |
