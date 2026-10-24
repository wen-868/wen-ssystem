# WORKBENCH-06F2 证据包 · AI 计划状态契约对齐

> 负责人：墨（工作台前端 owner）｜2026-10-25
> 基线：`e68315f4224deb6114cc035de406eade74952503`（＝ F1 尖端）
> 分支：`workbench/WORKBENCH-06F2-plan-status-contract`
> 工作树：`D:\Users\ZXQL\ZXQL-MS\wt-works\WORKBENCH-06F2`
> 上游驳回：`docs/tasks/cards/R101-WORKBENCH-06F1-凌舟验收与裁定-20261025.md`（B2-1 枚举不符 / B2-2 恒真断言）
> 契约源：`ZXQL-AI/src/brain/agent/agent.types.ts:14-23`

## 1. 真实状态契约（**唯一来源，已直读源码确认**）

```ts
// ZXQL-AI/src/brain/agent/agent.types.ts:13-23
/** 步骤状态（22.4 统一口径六态） */
export type PlanStepStatus =
  | 'pending'   // 待执行
  | 'running'   // 执行中
  | 'success'   // 成功
  | 'failed'    // 失败（触发自愈或单步容错）
  | 'suspended' // 挂起待人工确认
  | 'skipped';  // 跳过

/** 计划级状态（与步骤级六态一致） */
export type PlanState = PlanStepStatus;
```

**F1 的缺陷（本单修正）**：工作台曾用 `done / completed / succeeded / cancelled / canceled / rejected / aborted`
—— **底座一个都没有**。后果（凌舟实测）：
1. 真实 `state=success` 的计划被算成"进行中"；
2. 真实 `status=success` 的步骤不计入完成；
3. 真实 `skipped`（已跳过/取消）也被算成"进行中"；
4. 测试夹具也用虚构状态 ⇒ 23/23 全绿也**证明不了**真实契约。

## 2. 修正后的口径（`agent-metrics.ts`）

| 概念 | 口径 | 依据 |
|:--|:--|:--|
| **终态计划**（不计进行中） | `success`、`failed`、`skipped` | 六态语义：已完成/已失败/已跳过 |
| **非终态**（计入进行中） | `pending`、`running`、`suspended` | `suspended` = 挂起待人工，仍需处理，**不冒充成功** |
| **步骤完成** | 只认 `status === "success"` | `skipped` 占步骤位但**不算完成** |
| **步骤总数** | 每个有效 step 都计入（含 `skipped`） | 不把 `skipped` 当成功，也不从分母里偷偷剔除 |
| **未知状态值** | `normalizePlanStatus()` 返回 `null`；**不计入任何桶**，只在 `unknownStates` 如实计数 | 不猜（红线） |

实现要点：
- 新增 `PLAN_STEP_STATUSES`（六态常量）+ `PlanStepStatus` 类型 + `normalizePlanStatus()`（纯函数，可单测）；
- `TERMINAL_PLAN_STATES = Set<PlanStepStatus>(["success","failed","skipped"])`；
- `COMPLETED_STEP_STATUS = "success" satisfies PlanStepStatus`（用 `satisfies` 把口径钉在类型上）；
- 新增 `unknownStates` 字段：如实披露"后端出现本端不认识的枚举"，避免静默归桶。

## 3. 复跑命令（工作树根目录）

```powershell
# ① 契约用例（含 5 条新增真实枚举用例 + 3 条契约护栏）
node admin-web/tests/ai-status-truth.spec.mjs

# ② 全量（既有 137 条不得减少）
npm test --prefix admin-web

# ③ 五条 mutation（A/B/C 沿用 F1；D=删 success 终态；E=把旧 session-state 接回）
node admin-web/tests/ai-status-countertest.mjs

# ④ 虚构状态独立核验（产品代码 + 真实六态齐备）
node docs/evidence/WORKBENCH-06F2/tools/verify-no-fabricated-status.mjs

# ⑤ 门禁
node admin-web/node_modules/vue-tsc/bin/vue-tsc.js -b admin-web/tsconfig.json --force
node admin-web/node_modules/eslint/bin/eslint.js admin-web/src/
node admin-web/node_modules/vite/bin/vite.js build --config admin-web/vite.config.ts admin-web

# ⑥ 业务冻结面
git diff --name-only e68315f4 -- admin-web/src/views backend
```

## 4. 结果摘要（原始输出见 `logs/`、`redtest/`）

| 项 | 读数 | 原始 |
|:--|:--|:--|
| 契约用例 `ai-status-truth.spec.mjs` | **29 passed / 0 failed**（F1 原有 23 + F2 新增 6） | `logs/11-ai-status-truth.log` |
| 全量测试 `npm test` | **143 passed / 0 failed**（**既有 137 条一条未减** + 新增 6），各段 3/30/11/12/16/24/8/10/**29** | `logs/10-npm-test.log` |
| 五条 mutation 反测 | **5/5 点名变红** + **5/5 SHA256 恒等复原** + 复原后 29/29 回绿 | `logs/12-countertest.log`、`redtest/ai-status-countertest.md` |
| 虚构状态独立核验 | **PASS**：7 个虚构状态全 absent、6 个真实状态全 present | `logs/13-no-fabricated-status.log` |
| `vue-tsc -b --force` | **EXIT=0**（零输出，见 note） | `logs/20-vue-tsc.log`+`.note.txt` |
| `eslint src/` | **EXIT=0**（零输出，见 note） | `logs/21-eslint.log`+`.note.txt` |
| `vite build` | **EXIT=0**，✓ built in 2m 9s | `logs/30-build.log` |
| 业务冻结面 | `git diff --name-only e68315f4 -- admin-web/src/views backend` **零输出** | 本 README §6 |

## 5. 与驳回逐条对应

| 驳回项 | 修正 | 证据 |
|:--|:--|:--|
| **B2-1** 枚举不符 | 终态改为 `success/failed/skipped`；完成只认 `success`；`skipped` 计总数不计完成；`suspended` 保留为非终态 | `计划·真实契约：success 计划不计进行中…`（running=1 / steps=5/9）；`单条成功计划 ⇒ running=0`（**B2-1 核心**） |
| 测试用虚构夹具 | 全部夹具改为真实六态；并加**契约护栏用例**「测试夹具只用真实六态」 | `契约护栏：测试夹具只用真实六态` |
| **B2-2** 恒真断言 | 删除 `|| true`；改为在 `<AgentStatusBar>` 标签范围内做**真实负断言**（不得有 `:session-state`） | `结构：壳层接真实探针…`；mutation **E** 注入旧绑定后**点名红** |
| F2 §二.5 新增 mutation | 新增 **D**（删 `success` 终态识别）+ **E**（把旧 `:session-state` 接回） | `redtest/ai-status-countertest.md` |

> **为什么负断言要限定在 AgentStatusBar 标签内**：壳层仍会渲染 `AiFeedView` / `AiChatPanel`，
> 它们**合法**使用 `:session-state` 传会话状态。全局 ban 会误伤正常接线；只禁 `AgentStatusBar` 标签内的旧绑定才精准。
> 这一点写入用例注释，防止后人"简化"成全局 ban 反而误伤。

## 6. 目录结构

```text
docs/evidence/WORKBENCH-06F2/
├── README.md                          # 本文件
├── tools/
│   └── verify-no-fabricated-status.mjs # 独立核验：产品代码零虚构状态 + 真实六态齐备
├── logs/                              # 10-npm-test / 11-ai-status-truth / 12-countertest /
│                                      # 13-no-fabricated-status / 20-vue-tsc(+note) / 21-eslint(+note) / 30-build
└── redtest/
    └── ai-status-countertest.md       # 五条 mutation：注入 SHA → FAIL 原文 → 复原 SHA → 回绿
```

## 7. 未验项（沿用 F1，如实保留）

1. **员工/计划的"非空真实读数"运行态**：仍无生产凭据 ⇒ 未验。F2 卡 §二.7 明确"没有时明确保留未验，不得用原型数字"。**本单未用任何 mock/原型数据。**
2. **非空业务菜单运行态**：mock DB 无菜单行。
3. **AI 正常在线问答链路**：本单不涉及。
4. **`suspended` 的 UI 提示文案**：本单只把它**排除出终态**（计入进行中），未在顶栏增加"挂起待人处理"的专项文案——顶栏只有 `进行中` 一个聚合口径。若需要细分展示，属后续增强项（不属本单硬验收）。
