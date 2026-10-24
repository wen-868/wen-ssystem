# WORKBENCH-06F2 反测记录（五条 mutation）

> 被测用例：`admin-web/tests/ai-status-truth.spec.mjs`（23 例）
> 装置：`admin-web/tests/ai-status-countertest.mjs`（注入 → 断言点名红 → 逐字节复原 SHA256 → 复跑回绿）

| 反测 | 目标文件 | 注入手法 | EXIT | FAIL 行数 | 点名命中 | 注入后 SHA256 | 复原 SHA256 | 恒等 |
|:--|:--|:--|--:|--:|:--:|:--|:--|:--:|
| A-idle-as-online | `src/shared/workbench/ai-readiness.ts` | 把失败/idle 改回「在线」 | 1 | 2 | ✅ | `F225DE13AE0753AA…` | `9865AC856D75F3F8…` | ✅ |
| B-employees-constant | `src/shared/workbench/agent-metrics.ts` | 删除 employees 真实调用 | 1 | 3 | ✅ | `DABD0018FEBF113D…` | `9B9FBFD875EFC09A…` | ✅ |
| C-plans-constant | `src/shared/workbench/agent-metrics.ts` | 删除 plans 真实调用 | 1 | 1 | ✅ | `CE2428CCD091607C…` | `9B9FBFD875EFC09A…` | ✅ |
| D-drop-success-terminal | `src/shared/workbench/agent-metrics.ts` | 删除真实 success 终态识别 | 1 | 2 | ✅ | `8B0E639794A9D2D2…` | `9B9FBFD875EFC09A…` | ✅ |
| E-revert-session-state-binding | `src/layouts/WorkbenchShell.vue` | 把旧 :session-state 接回 AgentStatusBar（退回到 B1 假绿接线） | 1 | 1 | ✅ | `EA950B7D8641A87E…` | `4E348142F08D66A3…` | ✅ |

## 逐条 FAIL 原文

### A-idle-as-online

```text
FAIL  状态机：resolveReadiness 真值表（网络失败/CORS/401/形状异常 全非绿）  ← Expected values to be strictly equal:
FAIL  状态机·实跑：HTTP 500 + body ready ⇒ error（body 不可信当 HTTP 失败）  ← 非 2xx ⇒ error（不因 body 而判绿）
```

### B-employees-constant

```text
FAIL  员工：真实 HTTP 调用（走 AI_BASE_URL + JWT header），失败 ⇒ unknown  ← 应真实发起请求，实际 0（state=ready, error=null）
FAIL  员工：JWT 透传（有 token 时必须带 Authorization）  ← 必须携带真实 JWT
FAIL  两源独立降级：员工失败不影响计划成功，反之亦然  ← 员工源应 unknown
```

### C-plans-constant

```text
FAIL  计划：真实 HTTP 调用（/api/ai/agent/plans），失败 ⇒ unknown  ← 应真实发起 1 次请求
```

### D-drop-success-terminal

```text
FAIL  计划·真实契约：success 计划不计进行中、success 步骤计完成、skipped 不计完成  ← 只有 state=running 的 p1 算进行中（success/failed/skipped 都是终态）
FAIL  计划·真实契约：单条成功计划 ⇒ running=0（B2-1 核心：不得把 success 算成进行中）  ← 真实 success 计划必须不计入进行中（旧实现会算成 1）
```

### E-revert-session-state-binding

```text
FAIL  结构：壳层接真实探针与真实指标（非注释登记）  ← AgentStatusBar 不得再接 session-state（B1 假绿根因）；实际标签：<AgentStatusBar :readiness-state="aiReadiness.state" :session-state="aiSessionState" :pending-review-count="pendingReviewCount" :menu-state="menuState" @open-ledger="ledgerOpen = true" @retry-readiness="retryAiReadiness" />
```

## 复原后复跑

```text
PASS  状态机：只有 ready 判绿（isAiOnline 唯一真值）  ← ready=true / 其余 4 态=false
PASS  状态机：resolveReadiness 真值表（网络失败/CORS/401/形状异常 全非绿）  ← 8 组判定全部符合（无一条把失败判绿）
PASS  状态机：文案纪律 —— 只有 ready 文案允许出现「在线/就绪」  ← ready=就绪 / 其余=未检测·检测中·降级·不通
PASS  状态机：探针真实走 GET /api/health/ready（源码 + 允许注入 url）  ← health/ready + 双信号 + 冷却 + 并发去重 + 超时
PASS  状态机·实跑：桩 fetch 成功 ready ⇒ 状态转 ready（真调用路径）  ← 1 次真实调用 → ready（http://ai.test/api/health/ready）
PASS  状态机·实跑：桩 fetch 网络失败 ⇒ error（绝不假绿）  ← ERR_FAILED ⇒ error / 非绿
PASS  状态机·实跑：HTTP 500 + body ready ⇒ error（body 不可信当 HTTP 失败）  ← HTTP 500 ⇒ error
PASS  状态机·实跑：并发探测只发 1 次请求（防风暴）  ← 3 并发 → 1 请求
PASS  员工：解析成功（数组 ⇒ ready + 真实 count）  ← 2 名员工 ⇒ ready/count=2
PASS  员工：空数组 ⇒ ready 且 count=0（真空是真实结果，不是失败）  ← [] ⇒ ready/count=0
PASS  员工：异常形状 ⇒ unknown 且 count=null（绝不假 0）  ← 6 种异常形状全部 unknown/count=null
PASS  员工：真实 HTTP 调用（走 AI_BASE_URL + JWT header），失败 ⇒ unknown  ← 1 次真实调用 /api/ai/employees ⇒ unknown
PASS  员工：JWT 透传（有 token 时必须带 Authorization）  ← Authorization: Bearer <token> 已透传
PASS  计划·真实契约：success 计划不计进行中、success 步骤计完成、skipped 不计完成  ← running=1（success/failed/skipped 皆终态）/ steps=5/9（skipped 计总数不计完成）
PASS  计划·真实契约：pending / suspended 属非终态（计入进行中，suspended 待人处理）  ← pending+suspended+running ⇒ 3（suspended 不算 success，也不当终态丢弃）
PASS  计划·真实契约：单条成功计划 ⇒ running=0（B2-1 核心：不得把 success 算成进行中）  ← success 计划 running=0 / steps=1/1 —— 旧缺陷已修
PASS  计划·真实契约：非六态的未知状态不被猜（计 unknownStates，不进任何桶）  ← 未知状态不猜：unknownStates=2，不混入 running/stepsDone
PASS  计划：无 steps ⇒ 步骤口径置 null（不伪造 0/0）  ← steps=null/null（不写 0/0），running=1
PASS  计划：success=false ⇒ unknown（底座显式失败）  ← success=false ⇒ unknown/error=未认证
PASS  计划：异常形状 ⇒ unknown（不猜数据）  ← 6 种异常形状全部 unknown
PASS  计划：真实 HTTP 调用（/api/ai/agent/plans），失败 ⇒ unknown  ← 1 次真实调用 /api/ai/agent/plans ⇒ unknown
PASS  两源独立降级：员工失败不影响计划成功，反之亦然  ← employees=unknown / plans=ready（独立降级成立）
PASS  结构：AgentStatusBar 三格齐备 + 无 N/M 假分母 + 无静默 id  ← 三格齐 + 重试 + 无 sessionState/无假分母/无在线待命
PASS  结构：壳层接真实探针与真实指标（非注释登记）  ← 探针 + 指标 + readiness-state 透传 + 重试；AgentStatusBar 标签内无 session-state（真实负断言）
PASS  结构：能力台账 ai-06 文案已改为真实情况（不再是「无真实端点」）  ← ai-06 真实文案 + PARTIAL；ai-02 仍 PLANNED
PASS  回归：隐藏旧行为 —— 源码不得把 idle/挂载 当作在线  ← 3 文件代码区零「idle⇒在线」映射
PASS  契约护栏：agent-metrics.ts 代码区不得把虚构状态当作底座原生终态  ← 代码区零虚构状态；真实六态齐备
PASS  契约护栏：测试夹具只用真实六态（不再出现虚构状态字面量）  ← 5 处计划夹具（含 1 处负向验证用例）状态值全部在真实六态内
PASS  契约护栏：normalizePlanStatus 只接受真实六态  ← 6 真实态通过 / 10 非契约值返回 null
小结：29 passed / 0 failed
```
