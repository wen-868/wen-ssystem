# R101 · WORKBENCH-06F2 墨回传 —— AI 计划状态契约对齐

```text
【汇报 WORKBENCH-06F2】AI 计划状态契约对齐
汇报对象：凌舟（总负责人）
汇报人：墨（工作台负责人）｜2026-10-25
执行通道：WorkBuddy
交付物：见 §一（含路径 + 提交哈希）
证据（可复跑）：见 §三（命令 + 原始输出 + 文件路径）
验收自评：见 §四（逐条 通过/未通过 + 依据）
未完成与阻塞：见 §五
风险与自我报备：见 §六
回传要求：本汇报已落卡 docs/tasks/cards/R101-WORKBENCH-06F2-墨回传.md
关联卡：docs/tasks/inbox/WORKBENCH-06F2-plan-status-contract.md
```

> 上游驳回：`docs/tasks/cards/R101-WORKBENCH-06F1-凌舟验收与裁定-20261025.md`（B2-1 / B2-2）
> 基线：`e68315f4224deb6114cc035de406eade74952503`｜分支：`workbench/WORKBENCH-06F2-plan-status-contract`
> 工作树：`D:\Users\ZXQL\ZXQL-MS\wt-works\WORKBENCH-06F2`

---

## 〇、结论先行

**B2-1（枚举不符）与 B2-2（恒真断言）两条阻断项均已修正，并有可复跑证据 + mutation 分辨力。**

1. **先直读契约源码**（不采信转述）：`ZXQL-AI/src/brain/agent/agent.types.ts:14-23` 确认六态
   `pending | running | success | failed | suspended | skipped`，`PlanState = PlanStepStatus`。
2. 工作台改为：终态 = `success/failed/skipped`；完成只认 `success`；`skipped` 计总数不计完成；
   `pending/running/suspended` 计入进行中（`suspended` 不冒充成功）；未知状态不猜（`unknownStates` 计数）。
3. 删除 `|| true` 恒真断言，改为 `<AgentStatusBar>` 标签内**真实负断言**，并新增 mutation **E** 证明它会红。
4. 新增 mutation **D**：删掉 `success` 终态识别 ⇒ 精准点名 B2-1 核心用例变红。

## 一、交付物

| # | 交付物 | 路径 | 动作 |
|--:|:--|:--|:--|
| 1 | **状态契约对齐**：六态常量 + `PlanStepStatus` 类型 + `normalizePlanStatus()` + 终态集合修正 + `unknownStates` | `admin-web/src/shared/workbench/agent-metrics.ts` | 改 |
| 2 | **契约用例**：4 条真实枚举用例（success/skipped/failed 终态、success 步骤计完成、pending/suspended 非终态、未知状态不猜）+ 3 条契约护栏 | `admin-web/tests/ai-status-truth.spec.mjs` | 改（+6 例） |
| 3 | **恒真断言修复**：`|| true` 删除，改为 AgentStatusBar 标签内真实负断言 | 同上（`结构：壳层接真实探针…`） | 改 |
| 4 | **五条 mutation**：A/B/C 沿用 + **D**（删 success 终态）+ **E**（接回旧 `:session-state`） | `admin-web/tests/ai-status-countertest.mjs` | 改 |
| 5 | **独立核验工具**：产品代码零虚构状态 + 真实六态齐备 | `docs/evidence/WORKBENCH-06F2/tools/verify-no-fabricated-status.mjs` | 新增 |
| 6 | **证据包**：README + 7 日志(+2 note) + 5 条 mutation 记录 + 核验日志 | `docs/evidence/WORKBENCH-06F2/**` | 新增 |

**提交**：见 §七。

## 二、改动面

```
 admin-web/src/shared/workbench/agent-metrics.ts   | 改（状态契约 + 折算 + unknownStates）
 admin-web/tests/ai-status-truth.spec.mjs          | 改（+6 例、恒真断言修复、夹具改真实枚举）
 admin-web/tests/ai-status-countertest.mjs         | 改（+2 条 mutation、证据路径改 F2）
新增：docs/evidence/WORKBENCH-06F2/**（README + tools + logs + redtest）
```

**未动**：`admin-web/src/views/**`、`backend/**`、`AI 底座契约`（`ZXQL-AI/**` 零改动）、
既有 8 个 spec 的用例、`AgentStatusBar.vue`（F1 已正确，本单只改数据折算与断言）。

> 本单**未改** `AgentStatusBar.vue` / `ai-readiness.ts` —— B1 已被验收通过，不动。

## 三、证据（可复跑，全部原始输出已落盘）

### 3.1 真实契约与修正口径

**契约直读**（`ZXQL-AI/src/brain/agent/agent.types.ts:13-23`）：
```ts
export type PlanStepStatus = 'pending' | 'running' | 'success' | 'failed' | 'suspended' | 'skipped';
export type PlanState = PlanStepStatus;
```

**修正表**：

| 概念 | F2 修正后 | F1 错误写法 |
|:--|:--|:--|
终态计划 | `success` / `failed` / `skipped` | `done/completed/succeeded/cancelled/canceled/rejected/aborted`（虚构） |
进行中 | `pending` / `running` / `suspended` | 非终态即算（但终态集合本身是错的） |
步骤完成 | 只认 `success` | `done/completed/succeeded`（虚构） |
步骤总数 | 每个有效 step 都计入（含 `skipped`） | 同（但完成判定错） |
未知状态 | `normalizePlanStatus()` ⇒ `null`；计入 `unknownStates`，不进任何桶 | 静默按非终态算 |

### 3.2 契约用例（29 passed / 0 failed）

关键新增用例原文：
```
PASS  计划·真实契约：success 计划不计进行中、success 步骤计完成、skipped 不计完成
      ← running=1（success/failed/skipped 皆终态）/ steps=5/9（skipped 计总数不计完成）
PASS  计划·真实契约：pending / suspended 属非终态（计入进行中，suspended 待人处理）
      ← pending+suspended+running ⇒ 3（suspended 不算 success，也不当终态丢弃）
PASS  计划·真实契约：单条成功计划 ⇒ running=0（B2-1 核心：不得把 success 算成进行中）
      ← success 计划 running=0 / steps=1/1 —— 旧缺陷已修
PASS  计划·真实契约：非六态的未知状态不被猜（计 unknownStates，不进任何桶）
      ← 未知状态不猜：unknownStates=2，不混入 running/stepsDone
PASS  契约护栏：agent-metrics.ts 代码区不得把虚构状态当作底座原生终态
      ← 代码区零虚构状态；真实六态齐备
PASS  契约护栏：测试夹具只用真实六态（不再出现虚构状态字面量）
      ← N 处计划夹具（含 1 处负向验证用例）状态值全部在真实六态内
PASS  契约护栏：normalizePlanStatus 只接受真实六态
      ← 6 真实态通过 / 10 非契约值返回 null
```
原始：`logs/11-ai-status-truth.log`

**B2-1 核心用例的判别力**：`单条成功计划` 用例明确断言 `runningPlans === 0` 且 `stepsDone === 1`。
F1 的旧实现在此夹具下会得到 `running=1 / stepsDone=0`（**必然红**），因此该用例**真能分辨**真实契约。

### 3.3 恒真断言修复（B2-2）

**删除的旧写法**（`ai-status-truth.spec.mjs`，F1）：
```js
assert.ok(!/:session-state="aiSessionState"[\s\S]{0,200}<AgentStatusBar/.test(shell) || true);
```

**改为真实负断言**：
```js
const agentBarTag = shell.match(/<AgentStatusBar\b[\s\S]*?\/?>/);
assert.ok(agentBarTag, "壳层必须渲染 <AgentStatusBar>");
assert.ok(
  !/:(session-state|sessionState)\b/.test(agentBarTag[0]),
  `AgentStatusBar 不得再接 session-state（B1 假绿根因）；实际标签：${...}`,
);
assert.ok(
  /:readiness-state="aiReadiness\.state"/.test(agentBarTag[0]),
  "AgentStatusBar 必须以 readiness-state 接收真实就绪态",
);
```

**为什么限定在 `AgentStatusBar` 标签内**（写进用例注释，防后人"简化"成全局 ban）：
壳层仍渲染 `AiFeedView` / `AiChatPanel`，它们**合法**使用 `:session-state` 传会话状态；全局 ban 会误伤正常接线。
只禁 `AgentStatusBar` 标签内的旧绑定才精准。

**证明它会红**：mutation **E**（把 `:session-state` 接回）⇒ 用例点名红（见 §3.4）。

### 3.4 五条 mutation 反测

```
[反测 A-idle-as-online]              EXIT=1；FAIL=2；点名「状态机」=true        复原 SHA256 恒等=true
[反测 B-employees-constant]          EXIT=1；FAIL=3；点名「员工」=true          复原 SHA256 恒等=true
[反测 C-plans-constant]              EXIT=1；FAIL=1；点名「计划」=true          复原 SHA256 恒等=true
[反测 D-drop-success-terminal]       EXIT=1；FAIL=2；点名「计划·真实契约」=true   复原 SHA256 恒等=true
[反测 E-revert-session-state-binding] EXIT=1；FAIL=1；点名「壳层接真实探针」=true  复原 SHA256 恒等=true
复原后复跑：EXIT=0（29 passed / 0 failed）
全部反测通过：5/5 点名变红 + 5/5 SHA256 恒等 + 复原后回绿
```
原始：`logs/12-countertest.log`、`redtest/ai-status-countertest.md`

**D 的 FAIL 原文**（精准落在 B2-1 核心）：
```
FAIL  计划·真实契约：success 计划不计进行中、success 步骤计完成、skipped 不计完成
FAIL  计划·真实契约：单条成功计划 ⇒ running=0（B2-1 核心：不得把 success 算成进行中）
      ← 真实 success 计划必须不计入进行中（旧实现会算成 1）
```
**E 的 FAIL 原文**（证明负断言有分辨力）：
```
FAIL  结构：壳层接真实探针与真实指标（非注释登记）
      ← AgentStatusBar 不得再接 session-state（B1 假绿根因）；
        实际标签：<AgentStatusBar :readiness-state="aiReadiness.state" :session-state="aiSessionState" … />
```

### 3.5 虚构状态独立核验

```
== 产品代码 agent-metrics.ts（代码区）==
  done absent(OK) / completed absent(OK) / succeeded absent(OK) / cancelled absent(OK)
  canceled absent(OK) / rejected absent(OK) / aborted absent(OK)
== 真实六态必须齐备 ==
  pending present(OK) / running present(OK) / success present(OK)
  failed present(OK) / suspended present(OK) / skipped present(OK)
结论：PASS —— 零虚构状态、真实六态齐备
```
原始：`logs/13-no-fabricated-status.log`

### 3.6 门禁与测试守恒

| 门禁 | 命令 | 读数 | 原始 |
|:--|:--|:--|:--|
全量测试 | `npm test --prefix admin-web` | **143 passed / 0 failed**（**既有 137 条一条未减** + 新增 6），各段 3/30/11/12/16/24/8/10/**29**，EXIT=0 | `logs/10-npm-test.log` |
类型 | `vue-tsc -b admin-web/tsconfig.json --force` | **EXIT=0**，零输出 | `logs/20-vue-tsc.log`(+`.note.txt`) |
lint | `eslint admin-web/src/` | **EXIT=0**，零输出 | `logs/21-eslint.log`(+`.note.txt`) |
构建 | `vite build --config admin-web/vite.config.ts admin-web` | **EXIT=0**，✓ built in 2m 9s | `logs/30-build.log` |

### 3.7 业务冻结面（§三.6）

```
$ git diff --name-only e68315f4 -- admin-web/src/views backend
（零输出）
```
⇒ `views/**` 与 `backend/**` 相对基线 **零改动**；`ZXQL-AI/**`（AI 底座契约）**零改动**。

## 四、验收自评（逐条对卡 §三 硬验收）

| 硬验收 | 自评 | 依据 |
|:--|:--|:--|
**1. 真实 success 计划不再计进行中、success 步骤计入完成、skipped 不计完成** | **通过** | `单条成功计划 ⇒ running=0 / steps=1/1`；`success 计划不计进行中…` 用例 running=1（只有 running 那条）、steps=5/9（skipped 计总数不计完成） |
**2. 测试夹具全部来自真实后端 enum；代码中不再把 done/completed/succeeded 当原生终态** | **通过** | 夹具全改六态；契约护栏两条用例（代码区零虚构 + 夹具零虚构）；独立核验工具 PASS |
**3. `|| true` 删除；结构负断言删门后必红；删 success 识别 mutation 必红** | **通过** | 恒真断言已删除并换真实负断言；mutation E 接回旧绑定 ⇒ 点名红；mutation D 删 success 终态 ⇒ 点名红 |
**4. `npm test` 137 条不减；vue-tsc/ESLint/build EXIT=0** | **通过** | 143 = 137 + 6；三项门禁均 EXIT=0 |
**5. 员工/计划非空运行态无凭据须保持"未验"** | **通过** | 本单**未新增**任何运行态声明；README §7.1 明确仍为未验，**未用 mock/原型数字** |
**6. `views/**`、`backend/**` 相对 e68315f4 零改动** | **通过** | `git diff` 零输出（§3.7） |
**7. 工作树 clean、未 push、未开 PR、逐文件 add** | **通过** | 见 §七 |

卡 §二 交付物逐条：
1. ✅ 以 `agent.types.ts` 为唯一契约（六态常量 + 类型 + 归一函数，注释列明出处）
2. ✅ 修正 `TERMINAL_PLAN_STATES` 与步骤完成判定
3. ✅ 夹具全部改真实枚举（5 个场景逐条覆盖 §二.3 列举的 6 项）
4. ✅ 恒真断言修复 + mutation E
5. ✅ 新增 mutation D（删 success 识别）
6. ✅ 复跑 137 条不减（实为 143 = 137 + 6）
7. ✅ 运行态非空读数：无凭据 ⇒ 明确保留未验，未用原型数字
8. ✅ 证据 `docs/evidence/WORKBENCH-06F2/**` + 回传卡本文件

## 五、未完成与阻塞

**无阻塞项。** 未验项（沿用 F1，如实保留）：

1. **员工/计划的"非空真实读数"运行态**：仍无生产凭据 ⇒ **未验**。F2 卡 §二.7 明确"没有时明确保留未验，不得用原型数字"。本单**未新增**运行态声明、**未用**任何 mock/原型数据。
2. **非空业务菜单运行态**：mock DB 无菜单行（F1 已登记）。
3. **AI 正常在线问答链路**：本单不涉及。
4. **`suspended` 的专项 UI 文案**：本单只把它**排除出终态**（计入进行中），顶栏仍只有「进行中计划 N」一个聚合口径，未增加"挂起待人工"细分展示。**这是口径选择而非遗漏**：派单卡 §二.1 只要求"suspended 保留为待人工处理、不冒充 success"，本实现满足该要求；细分展示若需要，属后续增强。

## 六、风险与自我报备

1. **F1 的枚举错误是我的责任**：我凭印象写了 `done/completed/succeeded` 一套，且**用它自己的虚构夹具自证**（23/23 全绿）——这正是"用错误前提自证正确"的典型。教训：**接外部契约前必须直读对方源码的类型定义，不能凭命名习惯推断**。本单已改为先读 `agent.types.ts` 再写代码。
2. **恒真断言 `|| true` 是我写的**：属"为了让测试先过"的坏习惯，性质等同假门禁。已删除并改为真实负断言；同时把"限定在 AgentStatusBar 标签内"的理由写进注释，防止后人误判为可以全局 ban。
3. **负断言的边界是刻意收窄的**：不是"壳层全局不得出现 `:session-state`"（那会误伤 AiFeedView/AiChatPanel 的合法用法），而是"AgentStatusBar 标签内不得出现"。若凌舟认为该口径过窄，我可以改为"白名单文件 + 标签双重校验"，但那属增强，本单先按精准最小口径。
4. **`unknownStates` 是新增字段**：用于如实披露"后端出现了本端不认识的枚举"，避免静默归桶。它是可选字段，不影响既有调用方；但**UI 暂未消费它**（顶栏只显示进度聚合）。若需要把"存在未知状态"提示给用户，属后续增强。
5. **mutation E 的注入技法**：因 `WorkbenchShell.vue` 是 CRLF，首版用带 `\n` 的 marker 匹配失败。已改为"单属性片段定位 + 同行追加"，**不引入行尾差异**，确保复原 SHA256 逐字节恒等（已验 5/5）。
6. **未改 AI 底座契约**：`ZXQL-AI/**` 零改动，本单只对齐工作台消费侧（红线要求）。

## 七、提交与分支（未 push、未开 PR）

逐文件 `git add`（**未用 `git add -A`**）。提交见 `git log`；`git status` clean；
`git ls-remote origin workbench/WORKBENCH-06F2-plan-status-contract` 为空（未 push）。

## 八、环境复原

- 未启动任何服务（本单为纯静态契约对齐 + 单测；未做运行态取证，因 F2 卡未要求且无非空凭据）；
- 已删临时文件 `test-final.log`；
- 未提交产物：`admin-web/dist/`（`.gitignore` 忽略）；
- 反测注入：5 次全部逐字节复原（SHA256 见 `redtest/ai-status-countertest.md`）。

---

派单人：凌舟（总负责人）｜2026-10-25
汇报人：墨（工作台负责人）｜2026-10-25
